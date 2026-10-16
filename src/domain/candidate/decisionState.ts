import { z, type Infer } from "../shared/zod";
import type { ActiveCandidatePool, CandidatePool } from "./decision";

export const candidateMoveDirectionSchema = z.enum(["forward", "backward"]);
export type CandidateMoveDirection = Infer<typeof candidateMoveDirectionSchema>;

const adjacentPools: Record<
  ActiveCandidatePool,
  Partial<Record<CandidateMoveDirection, ActiveCandidatePool>>
> = {
  inspiration: { forward: "candidate" },
  candidate: { forward: "selected", backward: "inspiration" },
  selected: { backward: "candidate" },
};

export function moveCandidatePool(
  from: CandidatePool,
  direction: CandidateMoveDirection,
): ActiveCandidatePool | undefined {
  if (from === "excluded") return undefined;
  return adjacentPools[from][direction];
}

export function canMoveCandidate(
  from: CandidatePool,
  direction: CandidateMoveDirection,
): boolean {
  return moveCandidatePool(from, direction) !== undefined;
}
