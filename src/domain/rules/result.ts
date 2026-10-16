import { z, type Infer } from "../shared/zod";

const nonEmptyText = z.string().trim().min(1);
const boundedScore = z.number().min(0).max(100);

export const ruleModuleIdSchema = z.enum([
  "basic",
  "bazi_wuxing",
  "zodiac",
  "traditional",
  "name_hexagram",
  "five_grids",
]);

export const evidenceStatusSchema = z.enum(["pass", "notice", "conflict", "unknown"]);

export const ruleEvidenceSchema = z
  .object({
    id: nonEmptyText,
    projectId: nonEmptyText,
    candidateId: nonEmptyText,
    moduleId: ruleModuleIdSchema,
    dimensionId: nonEmptyText,
    ruleId: nonEmptyText,
    ruleVersion: nonEmptyText,
    schoolId: nonEmptyText.optional(),
    severity: z.enum(["hard", "soft"]),
    status: evidenceStatusSchema,
    applicability: z.enum(["applied", "not_applicable", "missing_input", "source_unverified"]),
    scoreBefore: boundedScore.optional(),
    deduction: boundedScore.optional(),
    scoreAfter: boundedScore.optional(),
    explanation: nonEmptyText,
    inputSummary: nonEmptyText,
    inputHash: nonEmptyText,
    calculation: z.array(nonEmptyText),
    sourceIds: z.array(nonEmptyText),
    uncertainty: nonEmptyText.optional(),
  })
  .strict()
  .superRefine((evidence, context) => {
    const scoreValues = [evidence.scoreBefore, evidence.deduction, evidence.scoreAfter];
    const hasAnyScore = scoreValues.some((value) => value !== undefined);
    const hasEveryScore = scoreValues.every((value) => value !== undefined);

    if (evidence.severity === "soft" && evidence.applicability === "applied") {
      if (!hasEveryScore)
        context.addIssue({
          code: "custom",
          message: "适用的软规则必须记录完整的扣分链",
          path: ["scoreBefore"],
        });
    } else if (hasAnyScore) {
      context.addIssue({
        code: "custom",
        message: "硬规则或未适用规则不能参与分数计算",
        path: ["scoreBefore"],
      });
    }

    if (
      evidence.scoreBefore !== undefined &&
      evidence.deduction !== undefined &&
      evidence.scoreAfter !== undefined &&
      Math.abs(evidence.scoreAfter - Math.max(0, evidence.scoreBefore - evidence.deduction)) >
        Number.EPSILON
    )
      context.addIssue({
        code: "custom",
        message: "扣分后的分数必须与扣分链一致",
        path: ["scoreAfter"],
      });

    if (evidence.applicability !== "applied" && evidence.status !== "unknown")
      context.addIssue({
        code: "custom",
        message: "未适用或资料不足的规则状态必须为 unknown",
        path: ["status"],
      });
  });

export type RuleModuleId = Infer<typeof ruleModuleIdSchema>;
export type EvidenceStatus = Infer<typeof evidenceStatusSchema>;
export type RuleEvidence = Infer<typeof ruleEvidenceSchema>;
