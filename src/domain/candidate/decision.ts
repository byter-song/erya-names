import { z, type Infer } from "../shared/zod";

export const activeCandidatePoolSchema = z.enum(["inspiration", "candidate", "selected"]);

export const candidatePoolSchema = z.enum(["inspiration", "candidate", "selected", "excluded"]);

const decisionIdentityShape = {
  candidateId: z.string().min(1),
  projectId: z.string().min(1),
  updatedAt: z.iso.datetime(),
};

const activeCandidateDecisionSchemas = [
  z
    .object({
      ...decisionIdentityShape,
      pool: z.literal("inspiration"),
    })
    .strict(),
  z
    .object({
      ...decisionIdentityShape,
      pool: z.literal("candidate"),
    })
    .strict(),
  z
    .object({
      ...decisionIdentityShape,
      pool: z.literal("selected"),
    })
    .strict(),
] as const;

const excludedCandidateDecisionSchema = z
  .object({
    ...decisionIdentityShape,
    pool: z.literal("excluded"),
    lastActivePool: activeCandidatePoolSchema,
    exclusionReason: z.string().trim().min(1).max(500),
    excludedAt: z.iso.datetime(),
  })
  .strict();

export const candidateDecisionSchema = z.discriminatedUnion("pool", [
  ...activeCandidateDecisionSchemas,
  excludedCandidateDecisionSchema,
]);

export type CandidatePool = Infer<typeof candidatePoolSchema>;
export type ActiveCandidatePool = Infer<typeof activeCandidatePoolSchema>;
export type CandidateDecision = Infer<typeof candidateDecisionSchema>;
export type ActiveCandidateDecision = Extract<CandidateDecision, { pool: ActiveCandidatePool }>;
export type ExcludedCandidateDecision = Extract<CandidateDecision, { pool: "excluded" }>;

export const DEFAULT_EXCLUSION_REASON = "未填写理由";

export function normalizeExclusionReason(reason?: string): string {
  const normalized = reason?.trim();
  return normalized ? normalized : DEFAULT_EXCLUSION_REASON;
}
