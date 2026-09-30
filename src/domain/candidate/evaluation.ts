import { z } from "zod";

export const candidateEvaluationSchema = z.object({
  projectId: z.string().min(1),
  candidateId: z.string().min(1),
  rating: z
    .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)])
    .optional(),
  note: z.string().trim().max(1000).optional(),
  updatedAt: z.iso.datetime(),
});

export type CandidateEvaluation = z.infer<typeof candidateEvaluationSchema>;
