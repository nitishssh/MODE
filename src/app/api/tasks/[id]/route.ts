import { getDatabase, NotFoundError } from "@/lib/database";
import { rejectUnsafeMutation } from "@/lib/mutation-guard";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchTaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  assigneeId: z.string().trim().min(1).max(100).nullable().optional(),
  eventId: z.string().trim().min(1).max(100).nullable().optional(),
  dueAt: z.string().datetime({ offset: true }).nullable().optional(),
}).strict();

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const task = getDatabase().getTaskById(id);
    return Response.json(task, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return Response.json({ error: "Task not found." }, { status: 404 });
    }
    console.error("MODE task fetch failed", error);
    return Response.json({ error: "Unable to load the task. Please try again." }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rejected = rejectUnsafeMutation(request);
  if (rejected) return rejected;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "The request must contain valid JSON." }, { status: 400 });
  }

  const parsed = patchTaskSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: "Please check the task details.",
        details: parsed.error.issues.map(({ path, message }) => ({ field: path.join("."), message })),
      },
      { status: 400 },
    );
  }

  try {
    const task = getDatabase().patchTask(id, parsed.data);
    return Response.json(task);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return Response.json({ error: "Task not found." }, { status: 404 });
    }
    console.error("MODE task patch failed", error);
    return Response.json({ error: "Unable to update the task. Please try again." }, { status: 500 });
  }
}
