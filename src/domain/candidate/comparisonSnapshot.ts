import { z, type Infer } from "../shared/zod";

const snapshotSourceSchema = z.object({
  sourceId: z.string().min(1),
  title: z.string().optional(),
  work: z.string().optional(),
  quote: z.string().optional(),
  location: z.string().optional(),
  excerpt: z.string().optional(),
  url: z.url().optional(),
  revision: z.string().min(1).optional(),
});

const snapshotRuleSchema = z.object({
  evidenceLevel: z.enum(["L1", "L2", "L3", "L4"]),
  outcome: z.enum(["pass", "warn", "reject", "unknown"]),
  ruleId: z.string().min(1),
  ruleVersion: z.string().min(1),
  explanation: z.string().min(1),
  sourceRefs: z.array(z.string()),
  scoreDelta: z.number().optional(),
});

const snapshotWarningSchema = z.object({
  ruleId: z.string().min(1),
  ruleVersion: z.string().min(1),
  explanation: z.string().min(1),
  sourceRefs: z.array(z.string()),
});

export const comparisonSnapshotCandidateSchema = z.object({
  id: z.string().min(1),
  fullName: z.string().min(1),
  pinyin: z.array(z.string()),
  sourceType: z.enum([
    "verified_allusion",
    "modern_combination",
    "user_input",
    "historical_inspiration",
  ]),
  summary: z.string(),
  sourceEvidence: z.array(snapshotSourceSchema).default([]),
  usageNotes: z.array(z.string()).default([]),
  warnings: z.array(snapshotWarningSchema).default([]),
  ruleEvidence: z.array(snapshotRuleSchema).default([]),
  rating: z.number().int().min(1).max(5).optional(),
  note: z.string().max(1000).optional(),
});

export const comparisonSnapshotSchema = z
  .object({
    id: z.string().min(1),
    projectId: z.string().min(1),
    name: z.string().trim().min(1).max(80),
    candidateIds: z.array(z.string().min(1)).min(2).max(5),
    candidates: z.array(comparisonSnapshotCandidateSchema).min(2).max(5),
    createdAt: z.iso.datetime(),
  })
  .superRefine((snapshot, context) => {
    if (
      snapshot.candidateIds.join("\0") !== snapshot.candidates.map((item) => item.id).join("\0")
    ) {
      context.addIssue({
        code: "custom",
        message: "Snapshot candidate ids do not match captured candidates",
      });
    }
  });

export type ComparisonSnapshotCandidate = Infer<typeof comparisonSnapshotCandidateSchema>;
export type ComparisonSnapshot = Infer<typeof comparisonSnapshotSchema>;
