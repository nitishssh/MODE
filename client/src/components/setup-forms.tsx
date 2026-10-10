import { useState } from "react";
import type { Member } from "../generated/contracts";
import { useSession } from "../lib/session";
import { useResource } from "../lib/use-resource";
import { amountPaise } from "../lib/journey";
import { Action, Copy, ErrorNotice, Row } from "./ui";
import { Field, useWrite, WriteNotice } from "./forms";
function integer(text: string, label: string) {
  if (!/^\d+$/.test(text))
    throw new Error(`${label} must be a whole nonnegative number.`);
  const value = Number(text);
  if (!Number.isSafeInteger(value)) throw new Error(`${label} is too large.`);
  return value;
}
function price(text: string) {
  return /^0(?:\.0{1,2})?$/.test(text.trim()) ? 0 : amountPaise(text);
}
export function EventCreate({ refresh }: { refresh(): Promise<void> }) {
  const [open, setOpen] = useState(false);
  const { client } = useSession();
  const write = useWrite();
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [start, setStart] = useState("");
  const [capacity, setCapacity] = useState("");
  const [member, setMember] = useState("");
  const [guest, setGuest] = useState("");
  if (!open) return <Action onPress={() => setOpen(true)}>New event</Action>;
  return (
    <Row>
      <Action onPress={() => setOpen(false)} disabled={write.busy}>
        Close event form
      </Action>
      <Copy kind="title">Publish an event</Copy>
      <Field
        label="Event title"
        value={title}
        onChangeText={setTitle}
        editable={!write.busy}
      />
      <Field
        label="Venue"
        value={venue}
        onChangeText={setVenue}
        editable={!write.busy}
      />
      <Field
        label="Starts at (ISO date with timezone, e.g. 2026-10-20T18:00:00+05:30)"
        value={start}
        onChangeText={setStart}
        editable={!write.busy}
      />
      <Field
        label="Capacity"
        value={capacity}
        onChangeText={setCapacity}
        keyboardType="number-pad"
        editable={!write.busy}
      />
      <Field
        label="Active member price in rupees"
        value={member}
        onChangeText={setMember}
        keyboardType="decimal-pad"
        editable={!write.busy}
      />
      <Field
        label="Guest price in rupees"
        value={guest}
        onChangeText={setGuest}
        keyboardType="decimal-pad"
        editable={!write.busy}
      />
      <WriteNotice state={write} />
      <Action
        disabled={write.busy}
        onPress={() =>
          void write.run(async () => {
            await client.request("/api/events", {
              method: "POST",
              body: JSON.stringify({
                title,
                venue,
                startsAt: start,
                capacity: integer(capacity, "Capacity"),
                memberPricePaise: price(member),
                guestPricePaise: price(guest),
                status: "published",
              }),
            });
            setTitle("");
            setVenue("");
            setStart("");
            setCapacity("");
            setMember("");
            setGuest("");
            write.setNotice("Event published.");
            await refresh();
          })
        }
      >
        Publish event
      </Action>
    </Row>
  );
}
export function ProductCreate({ refresh }: { refresh(): Promise<void> }) {
  const [open, setOpen] = useState(false);
  const { client } = useSession();
  const write = useWrite();
  const [name, setName] = useState("");
  const [standard, setStandard] = useState("");
  const [member, setMember] = useState("");
  const [sizes, setSizes] = useState("S:10, M:10, L:10");
  if (!open) return <Action onPress={() => setOpen(true)}>New product</Action>;
  return (
    <Row>
      <Action onPress={() => setOpen(false)} disabled={write.busy}>
        Close product form
      </Action>
      <Copy kind="title">Add merchandise</Copy>
      <Field
        label="Product name"
        value={name}
        onChangeText={setName}
        editable={!write.busy}
      />
      <Field
        label="Standard price in rupees"
        value={standard}
        onChangeText={setStandard}
        editable={!write.busy}
        keyboardType="decimal-pad"
      />
      <Field
        label="Active member price in rupees (optional)"
        value={member}
        onChangeText={setMember}
        editable={!write.busy}
        keyboardType="decimal-pad"
      />
      <Field
        label="Sizes and stock (size:quantity, separated by commas)"
        value={sizes}
        onChangeText={setSizes}
        editable={!write.busy}
      />
      <WriteNotice state={write} />
      <Action
        disabled={write.busy}
        onPress={() =>
          void write.run(async () => {
            const variants = sizes.split(",").map((item) => {
              const parts = item.trim().split(":");
              if (parts.length !== 2 || !parts[0].trim())
                throw new Error("Use size:quantity for each size.");
              return {
                size: parts[0].trim(),
                stock: integer(parts[1].trim(), "Stock"),
              };
            });
            await client.request("/api/products", {
              method: "POST",
              body: JSON.stringify({
                name,
                pricePaise: price(standard),
                memberPricePaise: member.trim() ? price(member) : null,
                variants,
              }),
            });
            setName("");
            setStandard("");
            setMember("");
            write.setNotice("Product added.");
            await refresh();
          })
        }
      >
        Add product
      </Action>
    </Row>
  );
}
export function TaskCreate({ refresh }: { refresh(): Promise<void> }) {
  const [open, setOpen] = useState(false);
  const { client } = useSession();
  const members = useResource<{ members: Member[] }>("/api/members");
  const write = useWrite();
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [due, setDue] = useState("");
  if (!open) return <Action onPress={() => setOpen(true)}>New task</Action>;
  return (
    <Row>
      <Action onPress={() => setOpen(false)} disabled={write.busy}>
        Close task form
      </Action>
      <Copy kind="title">Assign a task</Copy>
      <Field
        label="Task title"
        value={title}
        onChangeText={setTitle}
        editable={!write.busy}
      />
      <Field
        label="Due at (optional ISO date with timezone)"
        value={due}
        onChangeText={setDue}
        editable={!write.busy}
      />
      <ErrorNotice error={members.error} />
      <Action
        disabled={write.busy || !assignee}
        onPress={() => setAssignee("")}
      >
        Leave unassigned
      </Action>
      {members.data?.members.map((member) => (
        <Action
          key={member.id}
          disabled={write.busy || assignee === member.id}
          onPress={() => setAssignee(member.id)}
        >
          {assignee === member.id ? "Selected: " : "Assign to "}
          {member.name}
        </Action>
      ))}
      <WriteNotice state={write} />
      <Action
        disabled={write.busy || !title.trim()}
        onPress={() =>
          void write.run(async () => {
            await client.request("/api/tasks", {
              method: "POST",
              body: JSON.stringify({
                title,
                ...(assignee ? { assigneeId: assignee } : {}),
                ...(due.trim() ? { dueAt: due } : {}),
              }),
            });
            setTitle("");
            setDue("");
            write.setNotice("Task created.");
            await refresh();
          })
        }
      >
        Create task
      </Action>
    </Row>
  );
}
