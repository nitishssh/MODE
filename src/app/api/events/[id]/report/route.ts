import { getDatabase, NotFoundError } from "@/lib/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const report = getDatabase().getEventReport(id);
    return Response.json(report, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return Response.json({ error: "Event not found." }, { status: 404 });
    }
    console.error("MODE event report failed", error);
    return Response.json({ error: "Unable to load the event report. Please try again." }, { status: 500 });
  }
}
