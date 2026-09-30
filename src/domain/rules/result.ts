import { z } from "zod";

export const ruleResultSchema = z.object({
  id: z.string().min(1),
  candidateId: z.string().min(1),
  ruleId: z.string().min(1),
  evidenceLevel: z.enum(["L1", "L2", "L3", "L4"]),
  outcome: z.enum(["pass", "warn", "reject", "unknown"]),
  explanation: z.string().min(1),
  sourceRefs: z.array(z.string().min(1)),
  scoreDelta: z.number().optional(),
  ruleVersion: z.string().min(1),
});

export type RuleResult = z.infer<typeof ruleResultSchema>;
