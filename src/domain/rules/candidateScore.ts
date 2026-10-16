import { z, type Infer } from "../shared/zod";
import { evidenceStatusSchema } from "./result";

const nonEmptyText = z.string().trim().min(1);
const boundedScore = z.number().min(0).max(100);

export const candidateScoreSchema = z
  .object({
    candidateId: nonEmptyText,
    projectId: nonEmptyText,
    configRevision: z.number().int().nonnegative(),
    inputHash: nonEmptyText,
    hardStatus: evidenceStatusSchema,
    totalScore: boundedScore.optional(),
    completeness: z.number().min(0).max(1),
    evaluatedDimensions: z.number().int().nonnegative(),
    expectedDimensions: z.number().int().nonnegative(),
    hiddenScoredModuleCount: z.number().int().min(0).max(5),
    moduleScores: z
      .object({
        basic: boundedScore.optional(),
        bazi_wuxing: boundedScore.optional(),
        zodiac: boundedScore.optional(),
        traditional: boundedScore.optional(),
        name_hexagram: boundedScore.optional(),
        five_grids: boundedScore.optional(),
      })
      .strict(),
    topDeductions: z.array(
      z
        .object({
          ruleId: nonEmptyText,
          deduction: boundedScore,
          explanation: nonEmptyText,
        })
        .strict(),
    ),
  })
  .strict()
  .superRefine((score, context) => {
    if (score.evaluatedDimensions > score.expectedDimensions)
      context.addIssue({
        code: "custom",
        message: "已评估维度数不能超过应评估维度数",
        path: ["evaluatedDimensions"],
      });

    const expectedCompleteness =
      score.expectedDimensions === 0 ? 0 : score.evaluatedDimensions / score.expectedDimensions;
    if (Math.abs(score.completeness - expectedCompleteness) > Number.EPSILON)
      context.addIssue({
        code: "custom",
        message: "完整度必须等于已评估维度数除以应评估维度数",
        path: ["completeness"],
      });
  });

export type CandidateScore = Infer<typeof candidateScoreSchema>;
