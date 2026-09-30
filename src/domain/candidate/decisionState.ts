import type { CandidateStage } from "./decision";

const transitions: Record<CandidateStage, readonly CandidateStage[]> = {
  inbox: ["favorite", "comparison", "rejected"],
  favorite: ["inbox", "comparison", "rejected"],
  comparison: ["favorite", "finalist", "rejected"],
  finalist: ["comparison", "rejected"],
  rejected: ["inbox"],
};

export function canMoveCandidate(from: CandidateStage, to: CandidateStage): boolean {
  return transitions[from].includes(to);
}
