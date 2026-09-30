import { describe, expect, it } from "vitest";
import { canMoveCandidate } from "../../../src/domain/candidate/decisionState";
import { SessionUndoStack } from "../../../src/domain/candidate/sessionUndo";

describe("candidate decision state", () => {
  it("allows the single-user funnel transitions", () => {
    for (const [from, to] of [
      ["inbox", "favorite"],
      ["inbox", "comparison"],
      ["inbox", "rejected"],
      ["favorite", "inbox"],
      ["favorite", "comparison"],
      ["favorite", "rejected"],
      ["comparison", "favorite"],
      ["comparison", "finalist"],
      ["comparison", "rejected"],
      ["finalist", "comparison"],
      ["finalist", "rejected"],
      ["rejected", "inbox"],
    ] as const) {
      expect(canMoveCandidate(from, to), `${from} -> ${to}`).toBe(true);
    }
  });

  it("rejects unsupported shortcuts", () => {
    const stages = ["inbox", "favorite", "comparison", "finalist", "rejected"] as const;
    const allowed = new Set([
      "inbox:favorite",
      "inbox:comparison",
      "inbox:rejected",
      "favorite:inbox",
      "favorite:comparison",
      "favorite:rejected",
      "comparison:favorite",
      "comparison:finalist",
      "comparison:rejected",
      "finalist:comparison",
      "finalist:rejected",
      "rejected:inbox",
    ]);
    for (const from of stages) {
      for (const to of stages) {
        if (!allowed.has(`${from}:${to}`)) {
          expect(canMoveCandidate(from, to), `${from} -> ${to}`).toBe(false);
        }
      }
    }
  });
});

describe("SessionUndoStack", () => {
  it("undoes only bounded commands created in the current session", () => {
    const stack = new SessionUndoStack(2);
    stack.push({ projectId: "p1", candidateId: "c1", from: "inbox", to: "favorite" });
    stack.push({ projectId: "p1", candidateId: "c2", from: "inbox", to: "comparison" });
    stack.push({ projectId: "p1", candidateId: "c3", from: "inbox", to: "rejected" });
    expect(stack.pop("p1")).toEqual({
      projectId: "p1",
      candidateId: "c3",
      from: "rejected",
      to: "inbox",
    });
    expect(stack.hasCommands("p1")).toBe(true);
    expect(stack.pop("p1")).toEqual({
      projectId: "p1",
      candidateId: "c2",
      from: "comparison",
      to: "inbox",
    });
    expect(stack.hasCommands("p1")).toBe(false);
    expect(stack.pop("p1")).toBeUndefined();
  });

  it("keeps the twenty-command limit independently for each project", () => {
    const stack = new SessionUndoStack(2);
    stack.push({ projectId: "p1", candidateId: "p1-c1", from: "inbox", to: "favorite" });
    stack.push({ projectId: "p1", candidateId: "p1-c2", from: "inbox", to: "favorite" });
    stack.push({ projectId: "p2", candidateId: "p2-c1", from: "inbox", to: "favorite" });
    stack.push({ projectId: "p1", candidateId: "p1-c3", from: "inbox", to: "favorite" });
    expect(stack.pop("p1")?.candidateId).toBe("p1-c3");
    expect(stack.pop("p1")?.candidateId).toBe("p1-c2");
    expect(stack.pop("p2")?.candidateId).toBe("p2-c1");
  });
});
