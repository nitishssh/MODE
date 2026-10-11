import { json, route } from "../../../lib/http";
import { getPrivacyPolicy } from "../../../lib/privacy-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = route("privacy policy", () => json(getPrivacyPolicy()));
