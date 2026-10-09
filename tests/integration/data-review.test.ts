import { describe, expect, it } from "vitest";
import { reviewDecisionSchema } from "../../scripts/data/reviewSchema";
import {
  applyCharacterReviewDecisions,
  applyReviewDecisions,
} from "../../scripts/data/apply-review";
import { appendDecision, loadAllDecisions } from "../../scripts/data/reviewStore";
import os from "node:os";
import path from "node:path";

const candidate = {
  id: "allusion-candidate:1",
  sourceRecordId: "source:1",
  sourceId: "chinese-poetry:shijing",
  work: "诗经",
  title: "野有蔓草",
  location: "郑风",
  quote: "有美一人，清扬婉兮。",
  normalizedQuote: "有美一人，清扬婉兮。",
  selectedText: "清扬",
  reviewStatus: "unreviewed",
  machineSuggestion: { interpretation: "", risks: [] },
};

function approvedDecision() {
  return {
    candidateId: candidate.id,
    decision: "edit-and-approve",
    reviewer: { id: "owner@", kind: "human" },
    reviewedAt: "2026-09-18T00:00:00.000Z",
    sourceChecked: true,
    semanticNote: "取清秀明朗之意，原句上下文完整。",
    riskNote: "未发现明确负面语义；仍需结合姓氏检查谐音。",
    reviewStage: "primary",
    edits: { interpretation: "清秀明朗，神采飞扬。", styleTags: ["清朗自然"], risks: [] },
  };
}

describe("human review workflow", () => {
  it("requires auditable evidence fields for approval", () => {
    expect(() =>
      reviewDecisionSchema.parse({ ...approvedDecision(), sourceChecked: false }),
    ).toThrow();
    expect(() =>
      reviewDecisionSchema.parse({ ...approvedDecision(), semanticNote: "" }),
    ).toThrow();
    expect(() => reviewDecisionSchema.parse({ ...approvedDecision(), riskNote: "" })).toThrow();
  });

  it("prevents automation from self-approving machine suggestions", () => {
    expect(() =>
      reviewDecisionSchema.parse({
        ...approvedDecision(),
        reviewer: { id: "pipeline", kind: "automation" },
      }),
    ).toThrow();
    expect(() =>
      reviewDecisionSchema.parse({
        ...approvedDecision(),
        reviewer: { id: "traecode", kind: "agent" },
      }),
    ).toThrow();
  });

  it("supports all review decisions and only releases approved edits", () => {
    for (const decision of [
      "approve",
      "dispute",
      "retire",
      "request-source",
      "edit-and-approve",
    ] as const) {
      const input = {
        ...approvedDecision(),
        decision,
        ...(decision === "approve" || decision === "edit-and-approve"
          ? {}
          : { sourceChecked: false, semanticNote: "待处理", riskNote: "待处理" }),
      };
      expect(reviewDecisionSchema.parse(input).decision).toBe(decision);
    }
    const result = applyReviewDecisions([candidate], [approvedDecision()]);
    expect(result.approved).toEqual([
      expect.objectContaining({
        id: candidate.id,
        reviewStatus: "verified",
        interpretation: "清秀明朗，神采飞扬。",
      }),
    ]);
    expect(result.auditLog).toEqual([
      expect.objectContaining({ candidateId: candidate.id, decision: "edit-and-approve" }),
    ]);
  });

  it("does not project a non-approving secondary decision into release evidence", () => {
    const secondaryDispute = {
      ...approvedDecision(),
      reviewStage: "secondary",
      decision: "dispute",
      reviewer: { id: "second-owner@", kind: "human" },
    };
    const result = applyReviewDecisions([candidate], [approvedDecision(), secondaryDispute]);
    expect(result.approved[0]).not.toHaveProperty("secondaryReview");
    expect(result.disputed).toEqual([expect.objectContaining({ id: candidate.id })]);
  });

  it("is resumable and leaves undecided candidates pending", () => {
    const second = { ...candidate, id: "allusion-candidate:2", selectedText: "知远" };
    const result = applyReviewDecisions([candidate, second], [approvedDecision()]);
    expect(result.pending).toEqual([expect.objectContaining({ id: second.id })]);
  });

  it("appends decisions durably and rejects duplicate decisions", async () => {
    const directory = path.join(os.tmpdir(), `erya-review-${crypto.randomUUID()}`);
    await appendDecision(approvedDecision(), directory);
    await expect(appendDecision(approvedDecision(), directory)).rejects.toThrow(
      /already has a primary decision/,
    );
    await expect(loadAllDecisions(directory)).resolves.toEqual([
      expect.objectContaining({ candidateId: candidate.id }),
    ]);

    const secondary = {
      ...approvedDecision(),
      reviewStage: "secondary",
      reviewer: { id: "second-owner@", kind: "human" },
    };
    await expect(appendDecision(secondary, directory)).resolves.toMatchObject({
      reviewStage: "secondary",
    });
  });

  it("projects approved character decisions into production-ready character records", () => {
    const character = {
      id: "character:6e05",
      char: "清",
      pinyinSuggestions: ["qīng"],
      frequency: 12,
      reviewStatus: "unreviewed" as const,
      machineSuggestion: { namingSuitability: "unknown" as const, risks: [] },
    };
    const decision = {
      ...approvedDecision(),
      candidateId: character.id,
      edits: {
        interpretation: "清澈、明朗",
        pinyin: ["qīng"],
        styleTags: ["清朗自然"],
        risks: [],
      },
    };

    expect(applyCharacterReviewDecisions([character], [decision]).approved).toEqual([
      expect.objectContaining({
        id: character.id,
        char: "清",
        pinyin: ["qīng"],
        meanings: ["清澈、明朗"],
        reviewStatus: "verified",
        primaryReview: expect.objectContaining({ reviewer: "owner@" }),
      }),
    ]);
  });
});
