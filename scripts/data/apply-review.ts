import {
  reviewDecisionSchema,
  type AllusionReviewCandidate,
  type ReviewDecision,
  type AppliedHumanReview,
} from "./reviewSchema";
import type { CharacterReviewCandidate } from "./derive/characters";

export function applyReviewDecisions(candidates: AllusionReviewCandidate[], inputs: unknown[]) {
  const candidateIds = new Set(candidates.map((candidate) => candidate.id));
  const decisions = inputs
    .map((input) => reviewDecisionSchema.parse(input))
    .filter((decision) => candidateIds.has(decision.candidateId));
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

export function applyCharacterReviewDecisions(
  candidates: CharacterReviewCandidate[],
  inputs: unknown[],
) {
  const candidateIds = new Set(candidates.map((candidate) => candidate.id));
  const decisions = inputs
    .map((input) => reviewDecisionSchema.parse(input))
    .filter((decision) => candidateIds.has(decision.candidateId));
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
    const risks = decision.edits?.risks ?? candidate.machineSuggestion.risks;
    return [
      {
        id: candidate.id,
        char: candidate.char,
        pinyin: decision.edits?.pinyin ?? candidate.pinyinSuggestions,
        meanings: [decision.edits?.interpretation ?? decision.semanticNote],
        styleTags: decision.edits?.styleTags ?? [],
        risks,
        riskSignals: risks.map((risk) => ({
          kind: risk === "multiple-pronunciation" ? "multiple_pronunciation" : "input",
          outcome: "warn" as const,
          explanation: risk,
          sourceRefs: ["pinyin-data"],
          reviewStatus: "verified" as const,
        })),
        reviewStatus: "verified" as const,
        sourceRefs: [
          { sourceId: "standard-hanzi-2013", location: "通用规范汉字表" },
          {
            sourceId: "pinyin-data",
            location: `U+${candidate.char.codePointAt(0)?.toString(16)}`,
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
