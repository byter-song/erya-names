import { z } from "zod";

export const generationBatchSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  sequence: z.number().int().positive(),
  seed: z.string().min(1),
  requestedCount: z.number().int().min(1).max(200),
  profileSnapshot: z.record(z.string(), z.unknown()),
  datasetVersion: z.string().min(1),
  rulePackVersion: z.string().min(1),
  status: z.enum(["completed", "failed"]),
  statistics: z.object({
    sourceCandidates: z.number().int().nonnegative(),
    hardRejected: z.number().int().nonnegative(),
    duplicateRejected: z.number().int().nonnegative(),
    historicalRejected: z.number().int().nonnegative(),
    persisted: z.number().int().nonnegative(),
  }),
  createdAt: z.iso.datetime(),
});

export type GenerationBatch = z.infer<typeof generationBatchSchema>;
