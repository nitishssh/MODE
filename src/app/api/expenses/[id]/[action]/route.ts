import { getDatabase, NotFoundError, InvalidTransitionError } from "@/lib/database";
import { rejectUnsafeMutation } from "@/lib/mutation-guard";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const approveSchema = z.object({
  reviewerId: z.string().uuid("A valid reviewerId is required."),
}).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string; action: string }> }) {
  const rejected = rejectUnsafeMutation(request);
  if (rejected) return rejected;

  const { id, action } = await params;

  if (!["approve", "reject", "pay"].includes(action)) {
    return Response.json({ error: "Unknown action. Use approve, reject, or pay." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const db = getDatabase();

  try {
    if (action === "approve") {
      const parsed = approveSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json({ error: "A valid reviewerId is required to approve an expense." }, { status: 400 });
      }
      const expense = db.approveExpense(id, parsed.data.reviewerId);
      return Response.json(expense);
    }

    if (action === "reject") {
      const parsed = z.object({ reviewerId: z.string().uuid(), note: z.string().trim().max(500).optional() }).strict().safeParse(body);
      if (!parsed.success) {
        return Response.json({ error: "A valid reviewerId is required to reject an expense." }, { status: 400 });
      }
      const expense = db.rejectExpense(id, parsed.data.reviewerId, parsed.data.note);
      return Response.json(expense);
    }

    if (action === "pay") {
      const parsed = z.object({ paymentReference: z.string().trim().min(1, "A payment reference is required.").max(200) }).strict().safeParse(body);
      if (!parsed.success) {
        return Response.json(
          { error: "A paymentReference is required.", details: parsed.error.issues.map(({ path, message }) => ({ field: path.join("."), message })) },
          { status: 400 },
        );
      }
      const expense = db.payExpense(id, parsed.data.paymentReference);
      return Response.json(expense);
    }
  } catch (error) {
    if (error instanceof NotFoundError) {
      return Response.json({ error: "Expense not found." }, { status: 404 });
    }
    if (error instanceof InvalidTransitionError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    console.error(`MODE expense ${action} failed`, error);
    return Response.json({ error: `Unable to ${action} the expense. Please try again.` }, { status: 500 });
  }

  return Response.json({ error: "Unknown action." }, { status: 400 });
}
