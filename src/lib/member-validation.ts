import { z } from "zod";

export const createMemberSchema = z
  .object({
    name: z.string().trim().min(2, "Enter a name with at least 2 characters.").max(120),
    email: z.string().trim().max(254).email("Enter a valid email address.").toLowerCase(),
  })
  .strict();
