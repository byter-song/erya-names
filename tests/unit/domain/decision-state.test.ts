import { describe, expect, it } from "vitest";
import type { CandidatePool } from "../../../src/domain/candidate/decision";
import {
  canMoveCandidate,
  moveCandidatePool,
  type CandidateMoveDirection,
} from "../../../src/domain/candidate/decisionState";
import { SessionUndoStack } from "../../../src/domain/candidate/sessionUndo";

const pools = ["inspiration", "candidate", "selected", "excluded"] as const;
const directions = ["forward", "backward"] as const;

const expectedDestinations: Record<
  CandidatePool,
  Record<CandidateMoveDirection, CandidatePool | undefined>
> = {
  inspiration: { forward: "candidate", backward: undefined },
  candidate: { forward: "selected", backward: "inspiration" },
  selected: { forward: undefined, backward: "candidate" },
  excluded: { forward: undefined, backward: undefined },
};

describe("candidate decision state", () => {
  it.each(
    pools.flatMap((pool) =>
      directions.map((direction) => ({
        pool,
        direction,
        expected: expectedDestinations[pool][direction],
      })),
    ),
  )(
    "derives $pool + $direction without accepting a destination",
    ({ pool, direction, expected }) => {
      expect(moveCandidatePool(pool, direction)).toBe(expected);
      expect(canMoveCandidate(pool, direction)).toBe(expected !== undefined);
    },
  );

  it("exposes exactly four adjacent active-pool moves", () => {
    const legalMoves = pools.flatMap((pool) =>
      directions.flatMap((direction) => {
        const destination = moveCandidatePool(pool, direction);
        return destination ? [`${pool}:${direction}:${destination}`] : [];
      }),
    );

    expect(legalMoves).toEqual([
      "inspiration:forward:candidate",
      "candidate:forward:selected",
      "candidate:backward:inspiration",
      "selected:backward:candidate",
    ]);
  });
});

describe("SessionUndoStack", () => {
  it("returns the inverse of the most recent command for the same project", () => {
    const stack = new SessionUndoStack(2);
    stack.push({
      projectId: "p1",
      candidateId: "c1",
      from: "inspiration",
      to: "candidate",
    });
    stack.push({ projectId: "p1", candidateId: "c2", from: "candidate", to: "selected" });
    stack.push({
      projectId: "p1",
      candidateId: "c3",
      from: "inspiration",
      to: "candidate",
    });

    expect(stack.pop("p1")).toEqual({
      projectId: "p1",
      candidateId: "c3",
      from: "candidate",
      to: "inspiration",
    });
    expect(stack.pop("p1")).toEqual({
      projectId: "p1",
      candidateId: "c2",
      from: "selected",
      to: "candidate",
    });
    expect(stack.pop("p1")).toBeUndefined();
  });

  it("keeps the command limit independently for each project", () => {
    const stack = new SessionUndoStack(1);
    stack.push({
      projectId: "p1",
      candidateId: "p1-c1",
      from: "inspiration",
      to: "candidate",
    });
    stack.push({
      projectId: "p2",
      candidateId: "p2-c1",
      from: "inspiration",
      to: "candidate",
    });
    stack.push({
      projectId: "p1",
      candidateId: "p1-c2",
      from: "inspiration",
      to: "candidate",
    });
    expect(stack.pop("p1")?.candidateId).toBe("p1-c2");
    expect(stack.pop("p2")?.candidateId).toBe("p2-c1");
  });
});
