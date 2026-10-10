import { json, route } from "../../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Process liveness must not open a database or depend on an external service. */
export const GET = route("liveness", () => json({ status: "ok" }));
