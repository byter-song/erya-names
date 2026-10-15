import { z, type Infer } from "../shared/zod";

export const finalDecisionSchema = z.object({
  projectId: z.string().min(1),
  selectedCandidateId: z.string().min(1),
  rationale: z.string().trim().min(1).max(2000),
  updatedAt: z.iso.datetime(),
});

export type FinalDecision = Infer<typeof finalDecisionSchema>;
