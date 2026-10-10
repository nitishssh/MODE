import { getDatabase, NotFoundError, InvalidTransitionError } from "@/lib/database";
import { rejectUnsafeMutation } from "@/lib/mutation-guard";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateStatusSchema = z.object({
  status: z.enum(["todo", "in_progress", "done"]),
}).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rejected = rejectUnsafeMutation(request);
  if (rejected) return rejected;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "The request must contain valid JSON." }, { status: 400 });
  }

  const parsed = updateStatusSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: "Status must be todo, in_progress, or done.",
        details: parsed.error.issues.map(({ path, message }) => ({ field: path.join("."), message })),
      },
      { status: 400 },
    );
  }

  try {
    const task = getDatabase().updateTaskStatus(id, parsed.data.status);
    return Response.json(task);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return Response.json({ error: "Task not found." }, { status: 404 });
    }
    if (error instanceof InvalidTransitionError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    console.error("MODE task status update failed", error);
    return Response.json({ error: "Unable to update the task status. Please try again." }, { status: 500 });
  }
}
