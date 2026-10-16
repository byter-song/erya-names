import { z, type Infer } from "../shared/zod";

const nonEmptyText = z.string().trim().min(1);

export const assessmentRunStatusSchema = z.enum([
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const assessmentRunSchema = z
  .object({
    projectId: nonEmptyText,
    runId: nonEmptyText,
    configRevision: z.number().int().nonnegative(),
    status: assessmentRunStatusSchema,
    completed: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((run, context) => {
    if (run.completed > run.total)
      context.addIssue({
        code: "custom",
        message: "已完成数量不能超过总数量",
        path: ["completed"],
      });
    if (run.status === "completed" && run.completed !== run.total)
      context.addIssue({
        code: "custom",
        message: "完成状态必须处理全部候选",
        path: ["completed"],
      });
  });

export type AssessmentRunStatus = Infer<typeof assessmentRunStatusSchema>;
export type AssessmentRun = Infer<typeof assessmentRunSchema>;
