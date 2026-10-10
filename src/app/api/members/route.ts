import { DuplicateMemberError, getDatabase } from "../../../lib/database";
import { createMemberSchema } from "../../../lib/member-validation";
import { rejectUnsafeMutation } from "../../../lib/mutation-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ members: getDatabase().getMembers() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("MODE member list failed", error);
    return Response.json({ error: "Unable to load members. Please try again." }, { status: 500 });
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
  const parsed = createMemberSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: "Please check the member name and email address.",
        details: parsed.error.issues.map(({ path, message }) => ({ field: path.join("."), message })),
      },
      { status: 400 },
    );
  }
  try {
    return Response.json({ member: getDatabase().createMember(parsed.data) }, { status: 201 });
  } catch (error) {
    if (error instanceof DuplicateMemberError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    console.error("MODE member creation failed", error);
    return Response.json({ error: "Unable to add this member. Please try again." }, { status: 500 });
  }
}
