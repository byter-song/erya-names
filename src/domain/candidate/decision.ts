import { z } from "zod";

export const candidateStageSchema = z.enum([
  "inbox",
  "favorite",
  "comparison",
  "finalist",
  "rejected",
]);

export const candidateDecisionSchema = z.object({
  candidateId: z.string().min(1),
  projectId: z.string().min(1),
  stage: candidateStageSchema,
  rejectionReason: z.string().trim().min(1).max(500).optional(),
  updatedAt: z.iso.datetime(),
});

export type CandidateStage = z.infer<typeof candidateStageSchema>;
export type CandidateDecision = z.infer<typeof candidateDecisionSchema>;
