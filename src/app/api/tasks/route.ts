import { getDatabase } from "@/lib/database";
import { rejectUnsafeMutation } from "@/lib/mutation-guard";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200),
  description: z.string().trim().max(2000).optional(),
  assigneeId: z.string().trim().min(1).max(100).optional(),
  eventId: z.string().trim().min(1).max(100).optional(),
  dueAt: z.string().datetime({ offset: true }).optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = {
      status: searchParams.get("status") ?? undefined,
      assigneeId: searchParams.get("assigneeId") ?? undefined,
      eventId: searchParams.get("eventId") ?? undefined,
      overdue: searchParams.get("overdue") === "true",
      mine: searchParams.get("mine") === "true",
      currentUserId: searchParams.get("currentUserId") ?? "demo-member-1",
    };
    const tasks = getDatabase().getTasks(filters);
    return Response.json(tasks, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("MODE tasks list failed", error);
    return Response.json({ error: "Unable to load tasks. Please try again." }, { status: 500 });
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

  const parsed = createTaskSchema.safeParse(body);
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
    const task = getDatabase().createTask(parsed.data);
    return Response.json(task, { status: 201 });
  } catch (error) {
    console.error("MODE task creation failed", error);
    return Response.json({ error: "Unable to create the task. Please try again." }, { status: 500 });
  }
}
