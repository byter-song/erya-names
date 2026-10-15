import { z, type Infer } from "../shared/zod";

export const candidateStageSchema = z.enum([
  "inbox",
  "basic_shortlist",
  "folklore_review",
  "favorite",
  "comparison",
  "finalist",
  "excluded",
  "rejected",
]);

export const activeCandidateStageSchema = z.enum([
  "inbox",
  "basic_shortlist",
  "folklore_review",
  "comparison",
  "finalist",
]);

export const candidateDecisionSchema = z.object({
  candidateId: z.string().min(1),
  projectId: z.string().min(1),
  stage: candidateStageSchema,
  rejectionReason: z.string().trim().min(1).max(500).optional(),
  lastActiveStage: activeCandidateStageSchema.optional(),
  folkloreReviewed: z.boolean().optional(),
  updatedAt: z.iso.datetime(),
});

export type CandidateStage = Infer<typeof candidateStageSchema>;
export type ActiveCandidateStage = Infer<typeof activeCandidateStageSchema>;
export type CandidateDecision = Infer<typeof candidateDecisionSchema>;

export function normalizeCandidateStage(
  stage: CandidateStage,
): ActiveCandidateStage | "excluded" {
  if (stage === "favorite") return "basic_shortlist";
  if (stage === "rejected") return "excluded";
  return stage;
}

export function candidateRestoreStage(stage: CandidateStage): ActiveCandidateStage {
  const normalized = normalizeCandidateStage(stage);
  if (normalized === "excluded" || normalized === "finalist") return "comparison";
  return normalized;
}
