import { z } from "zod";

export const candidateSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  batchId: z.string().min(1).nullable(),
  normalizedFingerprint: z.string().min(1),
  surname: z.string().min(1),
  givenName: z.string().min(1),
  fullName: z.string().min(2),
  pinyin: z.array(z.string().min(1)),
  sourceType: z.enum(["verified_allusion", "modern_combination", "user_input"]),
  summary: z.string(),
  createdAt: z.iso.datetime(),
});

export type Candidate = z.infer<typeof candidateSchema>;
