import { getDatabase } from "@/lib/database";
import { rejectUnsafeMutation } from "@/lib/mutation-guard";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const submitExpenseSchema = z.object({
  amountPaise: z.number().int().min(1, "Amount must be at least 1 paise."),
  purpose: z.string().trim().min(3, "Purpose must be at least 3 characters.").max(500),
  submitterId: z.string().trim().min(1).max(100),
  receiptId: z.string().trim().min(1).max(100).optional(),
  receiptReference: z.string().trim().max(200).optional(),
  eventId: z.string().trim().min(1).max(100).optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const submitterId = searchParams.get("submitterId") ?? undefined;
    const expenses = getDatabase().getExpenses(submitterId ? { submitterId } : {});
    return Response.json(expenses, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("MODE expenses list failed", error);
    return Response.json({ error: "Unable to load expenses. Please try again." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const rejected = rejectUnsafeMutation(request);
  if (rejected) return rejected;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "The request must contain valid JSON." }, { status: 400 });
  }

  const parsed = submitExpenseSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: "Please check the expense details.",
        details: parsed.error.issues.map(({ path, message }) => ({ field: path.join("."), message })),
      },
      { status: 400 },
    );
  }

  try {
    const expense = getDatabase().submitExpense(parsed.data);
    return Response.json(expense, { status: 201 });
  } catch (error) {
    console.error("MODE expense submission failed", error);
    return Response.json({ error: "Unable to submit the expense. Please try again." }, { status: 500 });
  }
}
