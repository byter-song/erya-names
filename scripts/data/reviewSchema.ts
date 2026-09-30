import { z } from "zod";

const reviewerSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["human", "agent", "automation"]),
});

export const reviewDecisionSchema = z
  .object({
    candidateId: z.string().min(1),
    reviewStage: z.enum(["primary", "secondary"]),
    decision: z.enum(["approve", "dispute", "retire", "request-source", "edit-and-approve"]),
    reviewer: reviewerSchema,
    reviewedAt: z.iso.datetime(),
    sourceChecked: z.boolean(),
    semanticNote: z.string().min(1),
    riskNote: z.string().min(1),
    edits: z
      .object({
        selectedText: z.string().min(1).max(2).optional(),
        interpretation: z.string().min(1).optional(),
        styleTags: z.array(z.string().min(1)).min(1).optional(),
        risks: z.array(z.string()),
      })
      .optional(),
  })
  .superRefine((decision, context) => {
    const approves =
      decision.decision === "approve" || decision.decision === "edit-and-approve";
    if (approves && decision.reviewer.kind !== "human")
      context.addIssue({
        code: "custom",
        message: "Only a human reviewer may approve a candidate",
      });
    if (approves && !decision.sourceChecked)
      context.addIssue({ code: "custom", message: "Approval requires source verification" });
    if (decision.decision === "edit-and-approve" && !decision.edits?.interpretation)
      context.addIssue({
        code: "custom",
        message: "Edit-and-approve requires an interpretation edit",
      });
  });

export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;
export interface AppliedHumanReview {
  decision: "approve" | "edit-and-approve";
  reviewer: string;
  reviewedAt: string;
  sourceChecked: boolean;
  semanticNote: string;
  riskNote: string;
}

export interface AllusionReviewCandidate {
  id: string;
  sourceRecordId: string;
  sourceId: string;
  work: string;
  title: string;
  location: string;
  quote: string;
  normalizedQuote: string;
  selectedText: string;
  reviewStatus: "unreviewed";
  machineSuggestion: { interpretation: string; risks: string[] };
}
