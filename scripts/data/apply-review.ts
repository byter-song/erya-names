import {
  reviewDecisionSchema,
  type AllusionReviewCandidate,
  type ReviewDecision,
  type AppliedHumanReview,
} from "./reviewSchema";

export function applyReviewDecisions(candidates: AllusionReviewCandidate[], inputs: unknown[]) {
  const decisions = inputs.map((input) => reviewDecisionSchema.parse(input));
  const byCandidate = new Map<string, ReviewDecision[]>();
  for (const decision of decisions)
    byCandidate.set(decision.candidateId, [
      ...(byCandidate.get(decision.candidateId) ?? []),
      decision,
    ]);
  const approved = candidates.flatMap((candidate) => {
    const candidateDecisions = byCandidate.get(candidate.id) ?? [];
    const decision = candidateDecisions.find((item) => item.reviewStage === "primary");
    const secondaryDecision = candidateDecisions.find(
      (item) =>
        item.reviewStage === "secondary" &&
        (item.decision === "approve" || item.decision === "edit-and-approve"),
    );
    if (
      !decision ||
      (decision.decision !== "approve" && decision.decision !== "edit-and-approve")
    )
      return [];
    return [
      {
        ...candidate,
        selectedText: decision.edits?.selectedText ?? candidate.selectedText,
        interpretation: decision.edits?.interpretation ?? decision.semanticNote,
        styleTags: decision.edits?.styleTags ?? [],
        risks: decision.edits?.risks ?? candidate.machineSuggestion.risks,
        riskSignals: [],
        reviewStatus: "verified" as const,
        sourceRefs: [
          {
            sourceId: candidate.sourceId.split(":")[0] ?? candidate.sourceId,
            location: candidate.location,
            excerpt: candidate.quote,
          },
        ],
        primaryReview: toAppliedReview(decision),
        ...(secondaryDecision ? { secondaryReview: toAppliedReview(secondaryDecision) } : {}),
      },
    ];
  });
  return {
    approved,
    pending: candidates.filter((candidate) => !byCandidate.has(candidate.id)),
    disputed: candidates.filter((candidate) =>
      byCandidate.get(candidate.id)?.some((item) => item.decision === "dispute"),
    ),
    retired: candidates.filter((candidate) =>
      byCandidate.get(candidate.id)?.some((item) => item.decision === "retire"),
    ),
    sourceRequested: candidates.filter((candidate) =>
      byCandidate.get(candidate.id)?.some((item) => item.decision === "request-source"),
    ),
    auditLog: decisions.map((decision) => auditEntry(decision)),
  };
}

function toAppliedReview(decision: ReviewDecision): AppliedHumanReview {
  if (decision.decision !== "approve" && decision.decision !== "edit-and-approve")
    throw new Error("Only approving decisions can become release evidence");
  return {
    decision: decision.decision,
    reviewer: decision.reviewer.id,
    reviewedAt: decision.reviewedAt,
    sourceChecked: decision.sourceChecked,
    semanticNote: decision.semanticNote,
    riskNote: decision.riskNote,
  };
}

function auditEntry(decision: ReviewDecision) {
  return {
    candidateId: decision.candidateId,
    reviewStage: decision.reviewStage,
    decision: decision.decision,
    reviewer: decision.reviewer,
    reviewedAt: decision.reviewedAt,
    sourceChecked: decision.sourceChecked,
    semanticNote: decision.semanticNote,
    riskNote: decision.riskNote,
  };
}
