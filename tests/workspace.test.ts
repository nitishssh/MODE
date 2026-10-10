import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { openClubDatabase, getDatabase } from "../src/lib/database";
import { ForbiddenError, NotFoundError, ConflictError } from "../src/lib/errors";
import { actorFor, DEMO, FIXED_NOW, memoryDatabase, withRouteDatabase, loginCookie, apiRequest, routeParams } from "./helpers";
import { GET as tasks, POST as createTask } from "../src/app/api/tasks/route";
import { POST as taskStatus } from "../src/app/api/tasks/[id]/status/route";
import { GET as expenses, POST as submit } from "../src/app/api/expenses/route";
import { POST as action } from "../src/app/api/expenses/[id]/[action]/route";
import { GET as ledger } from "../src/app/api/ledger/summary/route";
import { POST as upload } from "../src/app/api/receipts/route";
import { GET as receiptDownload } from "../src/app/api/receipts/[id]/route";

test("workspace routes require sessions and derive submitter/reviewer identity from them", async () => {
  await withRouteDatabase(async () => {
    for (const handler of [tasks, expenses, ledger]) assert.equal((await handler(apiRequest("/api/tasks"))).status,401);
    assert.equal((await upload(apiRequest("/api/receipts",{method:"POST"}))).status,401);
    const member=await loginCookie("active@example.com"), treasurer=await loginCookie(DEMO.treasurer), organizer=await loginCookie(DEMO.organizer);
    assert.equal((await createTask(apiRequest("/api/tasks",{cookie:member,body:{title:"Not allowed"}}))).status,403);
    assert.equal((await ledger(apiRequest("/api/ledger/summary",{cookie:member}))).status,403);
    assert.equal((await submit(apiRequest("/api/expenses",{cookie:member,body:{amountPaise:12500,purpose:"Test supplies",submitterId:"someone-else"}}))).status,400);
    const created=await submit(apiRequest("/api/expenses",{cookie:member,body:{amountPaise:12500,purpose:"Test supplies"}}));
    assert.equal(created.status,201);
    const expense=await created.json();
    const params=routeParams({id:expense.id,action:"approve"});
    assert.equal((await action(apiRequest("/api/expenses",{cookie:organizer,body:{}}),params)).status,403);
    assert.equal((await action(apiRequest("/api/expenses",{cookie:treasurer,body:{reviewerId:"someone-else"}}),params)).status,400);
    assert.equal((await action(apiRequest("/api/expenses",{cookie:treasurer,body:{}}),params)).status,200);
    const pay=()=>action(apiRequest("/api/expenses",{cookie:treasurer,body:{paymentReference:"TEST-123"}}),routeParams({id:expense.id,action:"pay"}));
    assert.equal((await pay()).status,200); assert.equal((await pay()).status,200);
    assert.equal(getDatabase().ledger.list().filter(r=>r.sourceId===expense.id).length,1);
    const total=await (await ledger(apiRequest("/api/ledger/summary",{cookie:treasurer}))).json();
    assert.equal(total.balancePaise,getDatabase().ledger.balance());
    assert.equal((await action(apiRequest("/api/expenses",{cookie:treasurer,origin:"https://other.example",body:{}}),params)).status,403);
    assert.equal((await submit(apiRequest("/api/expenses",{cookie:member,rawBody:"{"}))).status,400);
  });
});

test("tasks enforce club boundaries, assignment permissions and normalized deadlines",()=>{
  const {db}=memoryDatabase();
  try{
    const organizer=actorFor(db,DEMO.organizer), volunteer=actorFor(db,DEMO.volunteer), member=actorFor(db,"active@example.com");
    const task=db.createTask(organizer,{title:"Welcome desk",assigneeId:volunteer.memberId,eventId:"demo-event-1",dueAt:"2026-10-10T14:00:00+05:30"});
    assert.equal(task.dueAt,"2026-10-10T08:30:00.000Z"); assert.equal(task.overdue,false);
    assert.equal(db.getTasks(volunteer,{mine:true}).some(t=>t.id===task.id),true);
    assert.throws(()=>db.updateTaskStatus(member,task.id,"done"),ForbiddenError);
    assert.equal(db.updateTaskStatus(volunteer,task.id,"done").status,"done");
    assert.throws(()=>db.patchTask(volunteer,task.id,{title:"Changed"}),ForbiddenError);
    const clubId=db.createClub("Other club");
    db.createMemberWithCredentials({name:"Other lead",email:"other@example.com",password:"other-pass-123",role:"admin",clubId});
    const other=actorFor(db,"other@example.com","other-pass-123");
    assert.throws(()=>db.getTaskById(other,task.id),NotFoundError);
    assert.throws(()=>db.createTask(other,{title:"Foreign assignee",assigneeId:volunteer.memberId}),NotFoundError);
    assert.throws(()=>db.createTask(other,{title:"Foreign event",eventId:"demo-event-1"}),NotFoundError);
    assert.equal(db.getLedgerEntries(other).length,0);
    assert.equal(db.getDashboard(other).transactions.length,0);
    assert.equal(db.getDashboard(other).events.length,0);
    assert.deepEqual(db.getDashboard().tasks, [], "anonymous dashboard must not disclose workspace tasks");
  } finally {db.close();}
});

test("expense ownership, self review, payment retry and rollback keep one reconciled ledger",()=>{
  const {db}=memoryDatabase();
  try{
    const member=actorFor(db,"active@example.com"), reviewer=actorFor(db,DEMO.treasurer), admin=actorFor(db,DEMO.admin);
    const before=db.ledger.balance();
    const expense=db.submitExpense(member,{amountPaise:25000,purpose:"Supplies",eventId:"demo-event-1"});
    assert.throws(()=>db.payExpense(reviewer,expense.id,"TEST-REF"),ConflictError);
    const own=db.submitExpense(reviewer,{amountPaise:500,purpose:"Own expense"});
    assert.throws(()=>db.approveExpense(reviewer,own.id),ForbiddenError);
    db.approveExpense(admin,own.id);
    assert.throws(()=>db.payExpense(reviewer,own.id,"SELF"),ForbiddenError);
    db.approveExpense(reviewer,expense.id);
    assert.equal(db.getLedgerSummary(reviewer).approvedUnpaidPaise,25500);
    assert.throws(()=>db.transaction(()=>{db.payExpense(reviewer,expense.id,"ROLLBACK");throw new Error("abort");}),/abort/);
    assert.equal(db.getExpenseById(member,expense.id).status,"approved");
    assert.equal(db.ledger.balance(),before);
    db.payExpense(reviewer,expense.id,"PAID-1");db.payExpense(reviewer,expense.id,"PAID-1");
    assert.throws(()=>db.payExpense(reviewer,expense.id,"PAID-2"),ConflictError);
    assert.equal(db.ledger.balance(),before-25000);
    assert.deepEqual(db.ledger.reconcile().orphans,[]);
    assert.equal(db.ledger.list().filter(r=>r.sourceId===expense.id).length,1);
    assert.equal(db.getLedgerSummary(reviewer).byEvent[0].outflowPaise,25000);
    const other=db.createClub("Other");
    db.createMemberWithCredentials({name:"Other lead",email:"other-lead@example.com",password:"other-pass-123",role:"admin",clubId:other});
    const outsider=actorFor(db,"other-lead@example.com","other-pass-123");
    assert.throws(()=>db.getExpenseById(outsider,expense.id),NotFoundError);
    assert.equal(db.getExpenses(outsider).length,0);
    assert.throws(()=>db.getExpenseById(actorFor(db,"expired@example.com"),expense.id),ForbiddenError);
  }finally{db.close();}
});

test("receipt upload is owned by session and private across accounts",async()=>{
  await withRouteDatabase(async()=>{
    const member=await loginCookie("active@example.com"), other=await loginCookie("expired@example.com"), treasurer=await loginCookie(DEMO.treasurer);
    const form=new FormData();form.append("file",new File(["%PDF-1.4 synthetic receipt"],"test.pdf",{type:"application/pdf"}));
    form.append("uploaderId","forged");form.append("uploaderName","forged");
    const response=await upload(new Request("http://localhost:3000/api/receipts",{method:"POST",headers:{Cookie:member,Origin:"http://localhost:3000"},body:form}));
    assert.equal(response.status,201);const receipt=await response.json();
    assert.notEqual(receipt.uploaderId,"forged");
    const params=routeParams({id:receipt.id});
    assert.equal((await receiptDownload(apiRequest("/api/receipts",{cookie:other}),params)).status,403);
    assert.equal((await receiptDownload(apiRequest("/api/receipts"),params)).status,401);
    const downloaded=await receiptDownload(apiRequest("/api/receipts",{cookie:treasurer}),params);
    assert.equal(downloaded.status,200);assert.equal(downloaded.headers.get("Cache-Control"),"private, no-store");
    assert.match(await downloaded.text(),/%PDF-1.4/);
    assert.equal((await submit(apiRequest("/api/expenses",{cookie:other,body:{amountPaise:100,purpose:"Wrong receipt",receiptId:receipt.id}}))).status,403);
    const task=await (await createTask(apiRequest("/api/tasks",{cookie:await loginCookie(DEMO.organizer),body:{title:"Assigned task",assigneeId:receipt.uploaderId}}))).json();
    assert.equal((await taskStatus(apiRequest("/api/tasks",{cookie:member,body:{status:"done"}}),routeParams({id:task.id}))).status,200);
  });
});

test("schema v8 upgrades preserve members, passes, sessions, merchandise and opening balances",()=>{
  const directory=mkdtempSync(join(tmpdir(),"mode-migration-"));
  const path=join(directory,"test.sqlite");
  let db: ReturnType<typeof openClubDatabase> | undefined;
  try{
    db=openClubDatabase(path,{now:()=>FIXED_NOW});
    const session=db.login({email:DEMO.admin,password:"mode-demo-2026"});
    const clubId=db.createClub("Migration club");
    db.createMemberWithCredentials({name:"Migration lead",email:"migration@example.com",password:"migration-123",role:"admin",clubId});
    const other=actorFor(db,"migration@example.com","migration-123");
    const product=db.merchandise.createProduct(other,{name:"Migration cap",pricePaise:2345,variants:[{size:"M",stock:2}]});
    const order=db.merchandise.createOrder(other,{variantId:product.variants[0].id});
    db.merchandise.confirmOrder(other,order.id,{reference:"MIGRATED-MERCH"});
    const pass=db.getPass(session.member.id),balance=db.ledger.balance(),count=db.getMembers().length;
    db.close();
    // Reconstruct the released v8 shape by removing only v9's additive schema.
    const raw=new DatabaseSync(path);
    raw.exec("DROP TABLE expenses; DROP TABLE receipts; DROP INDEX tasks_club_idx;");
    for(const column of ["club_id","description","assignee_id","event_id","due_at","created_at"])raw.exec("ALTER TABLE tasks DROP COLUMN "+column);
    for(const column of ["club_id","event_id"])raw.exec("ALTER TABLE transactions DROP COLUMN "+column);
    raw.exec("ALTER TABLE events DROP COLUMN fundraiser_goal_paise; PRAGMA user_version=8;");raw.close();
    db=openClubDatabase(path,{now:()=>FIXED_NOW});
    assert.equal(db.health().schemaVersion,9);assert.equal(db.getMembers().length,count);
    assert.equal(db.ledger.balance(),balance);assert.deepEqual(db.getPass(session.member.id),pass);
    assert.equal(db.getActor(session.token)?.memberId,session.member.id);
    assert.equal(db.getTasks(db.getActor(session.token)!).length,3);
    assert.equal(db.merchandise.listProducts(clubId).length,1);
    assert.equal(db.merchandise.requireOrder(clubId,order.id).status,"paid");
    assert.equal(db.getLedgerSummary(other).balancePaise,2345);
    assert.equal(db.getLedgerEntries(other)[0].reference,"MIGRATED-MERCH");
    assert.equal(db.getLedgerSummary(db.getActor(session.token)!).balancePaise,185000);
    assert.deepEqual(db.ledger.reconcile().orphans,[]);
    db.close();
  }finally{db?.close();rmSync(directory,{recursive:true,force:true});}
});


test("task editing clears nullable fields and filters overdue work correctly", () => {
  const {db}=memoryDatabase();
  try {
    const actor=actorFor(db,DEMO.organizer), volunteer=actorFor(db,DEMO.volunteer);
    const task=db.createTask(actor,{title:"Original",description:"Details",assigneeId:volunteer.memberId,eventId:"demo-event-1",dueAt:"2026-10-09T12:00:00Z"});
    assert.equal(db.getTasks(actor,{overdue:true,eventId:"demo-event-1",assigneeId:volunteer.memberId,status:"todo"}).length,1);
    const edited=db.patchTask(actor,task.id,{title:"Edited",description:null,assigneeId:null,eventId:null,dueAt:null});
    assert.equal(edited.title,"Edited");
    assert.deepEqual([edited.description,edited.assigneeId,edited.eventId,edited.dueAt],[null,null,null,null]);
    assert.equal(db.getTasks(actor,{overdue:true}).some(t=>t.id===task.id),false);
    assert.equal(db.getTaskById(actor,task.id).assignee,null);
    assert.deepEqual(db.patchTask(actor,task.id,{}),edited);
  } finally {db.close();}
});

test("expense rejection and CSV export preserve decisions and escape spreadsheet cells",async()=>{
  await withRouteDatabase(async()=>{
    const member=await loginCookie("active@example.com"), reviewer=await loginCookie(DEMO.treasurer);
    const db=getDatabase(),treasurer=actorFor(db,DEMO.treasurer);
    const expense=await (await submit(apiRequest("/api/expenses",{cookie:member,body:{amountPaise:175,purpose:'=SUM(1,2) "test"'}}))).json();
    assert.equal((await action(apiRequest("/api/expenses",{cookie:reviewer,body:{note:"Duplicate invoice"}}),routeParams({id:expense.id,action:"reject"}))).status,200);
    assert.equal(db.getExpenseById(treasurer,expense.id).rejectionNote,"Duplicate invoice");
    assert.equal((await action(apiRequest("/api/expenses",{cookie:reviewer,body:{}}),routeParams({id:expense.id,action:"approve"}))).status,409);
    assert.equal((await action(apiRequest("/api/expenses",{cookie:reviewer,body:{}}),routeParams({id:expense.id,action:"missing"}))).status,404);
    assert.equal((await action(apiRequest("/api/expenses",{cookie:reviewer,body:{paymentReference:""}}),routeParams({id:expense.id,action:"pay"}))).status,400);
    const payable=db.submitExpense(actorFor(db,"active@example.com"),{amountPaise:175,purpose:'=SUM(1,2) "test"'});
    db.approveExpense(treasurer,payable.id);db.payExpense(treasurer,payable.id,"REF-CSV");
    const {GET:csv}=await import("../src/app/api/ledger/export/route");
    assert.equal((await csv(apiRequest("/api/ledger/export"))).status,401);
    assert.equal((await csv(apiRequest("/api/ledger/export",{cookie:member}))).status,403);
    const output=await (await csv(apiRequest("/api/ledger/export",{cookie:reviewer}))).text();
    assert.ok(output.includes('"\'=SUM(1,2) ""test"""'));
    assert.ok(output.includes("REF-CSV"));assert.ok(output.includes("-1.75"));
    assert.ok(output.includes(",REF-CSV,-1.75"), "generated amounts remain numeric CSV cells");
  });
});

test("receipt validation rejects empty, oversized and disguised files",async()=>{
  await withRouteDatabase(async()=>{
    const cookie=await loginCookie("active@example.com");
    for(const [bytes,name,type,expected] of [
      ["","empty.pdf","application/pdf",400],
      ["not an image","fake.png","image/png",415],
      [new Uint8Array(2*1024*1024+1),"large.pdf","application/pdf",413],
    ] as const){
      const form=new FormData();form.append("file",new File([bytes],name,{type}));
      assert.equal((await upload(new Request("http://localhost:3000/api/receipts",{method:"POST",headers:{Cookie:cookie,Origin:"http://localhost:3000"},body:form}))).status,expected);
    }
    assert.equal((await upload(apiRequest("/api/receipts",{cookie,body:{}}))).status,400);
  });
});

test("dues, ticket income and expenses share scoped treasury and combined event reports",async()=>{
  await withRouteDatabase(async()=>{
    const db=getDatabase(),admin=actorFor(db,DEMO.admin),member=actorFor(db,"active@example.com");
    const event=db.events.createEvent(admin,{title:"Integration event",startsAt:"2026-11-01T13:30:00Z",venue:"Hall",capacity:10,memberPricePaise:5000,guestPricePaise:10000});
    const ticket=db.events.bookTicket(member,event.id);
    db.events.confirmTicket(admin,ticket.id,{reference:"TICKET-REF"});
    db.dues.recordDues(admin,{memberId:member.memberId,reference:"DUES-REF"});
    const product=db.merchandise.createProduct(admin,{name:"Integration shirt",pricePaise:1000,variants:[{size:"M",stock:2}]});
    const order=db.merchandise.createOrder(member,{variantId:product.variants[0].id});
    db.merchandise.confirmOrder(admin,order.id,{reference:"MERCH-REF"});
    db.createTask(admin,{title:"Prepare hall",eventId:event.id,dueAt:"2026-10-09T12:00:00Z"});
    const entries=db.getLedgerEntries(admin);
    assert.ok(entries.some(e=>e.reference==="TICKET-REF" && e.eventId===event.id && e.category==="events"));
    assert.ok(entries.some(e=>e.reference==="DUES-REF" && e.category==="membership"));
    assert.ok(entries.some(e=>e.reference==="MERCH-REF" && e.amountPaise===1000));
    const {GET:report}=await import("../src/app/api/events/[id]/report/route");
    const response=await report(apiRequest("/api/events/report",{cookie:await loginCookie(DEMO.admin)}),routeParams({id:event.id}));
    assert.equal(response.status,200);
    const result=await response.json();
    assert.equal(result.ticketsSold,1);assert.equal(result.realizedRevenuePaise,5000);
    assert.equal(result.fundraiser.raisedPaise,5000);assert.equal(result.tasks.overdue,1);
    assert.equal(db.getLedgerSummary(admin).balancePaise,db.ledger.balance());
    assert.deepEqual(db.ledger.reconcile().orphans,[]);
  });
});

