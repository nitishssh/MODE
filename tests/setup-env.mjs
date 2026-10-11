import { randomBytes } from "node:crypto";

// Isolated signing key for tests; never read or overwrite a deployment secret.
process.env.MODE_JWT_SECRET = randomBytes(32).toString("hex");
