import type { CandidateStage } from "./decision";

const transitions: Record<CandidateStage, readonly CandidateStage[]> = {
  inbox: ["basic_shortlist", "favorite", "comparison", "excluded", "rejected"],
  basic_shortlist: ["inbox", "folklore_review", "comparison", "excluded"],
  folklore_review: ["basic_shortlist", "comparison", "excluded"],
  favorite: ["inbox", "folklore_review", "comparison", "excluded", "rejected"],
  comparison: [
    "basic_shortlist",
    "folklore_review",
    "favorite",
    "finalist",
    "excluded",
    "rejected",
  ],
  finalist: ["comparison", "excluded", "rejected"],
  excluded: ["inbox", "basic_shortlist", "folklore_review", "comparison"],
  rejected: ["inbox", "basic_shortlist"],
};

export function canMoveCandidate(from: CandidateStage, to: CandidateStage): boolean {
  return transitions[from].includes(to);
}
