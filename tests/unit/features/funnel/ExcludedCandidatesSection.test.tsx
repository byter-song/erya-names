import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CandidateFunnelItem } from "../../../../src/application/models/CandidateFunnelItem";
import { ExcludedCandidatesSection } from "../../../../src/features/funnel/ExcludedCandidatesSection";

function excludedCandidate(
  id: string,
  fullName: string,
  lastActivePool: "inspiration" | "candidate" | "selected",
): CandidateFunnelItem {
  return {
    id,
    createdAt: "2026-10-15T08:00:00.000Z",
    givenName: fullName.slice(1),
    fullName,
    pinyin: ["sòng", "qīng", "yáng"],
    sourceType: "verified_allusion",
    summary: "清朗明亮",
    sourceEvidence: [],
    pool: "excluded",
    lastActivePool,
    exclusionReason: `${fullName}与方言读音不合`,
    excludedAt: "2026-10-16T02:30:00.000Z",
    decisionUpdatedAt: `2026-10-16T02:3${id}.000Z`,
    scoringPending: false,
    hardStatus: "pass",
    totalScore: 88,
    completeness: 1,
    moduleScores: {},
    topDeductions: [],
    hiddenScoredModuleCount: 0,
  };
}

const candidates = [
  excludedCandidate("1", "宋清扬", "candidate"),
  excludedCandidate("2", "宋知远", "selected"),
];

describe("ExcludedCandidatesSection", () => {
  it("shows the original pool, reason and exclusion time, then restores one item", async () => {
    const restore = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <ExcludedCandidatesSection
        candidates={candidates}
        onClear={vi.fn()}
        onRestore={restore}
      />,
    );

    const item = screen.getByText("宋清扬").closest("li");
    expect(item).not.toBeNull();
    expect(within(item!).getByText("候选池")).toBeVisible();
    expect(within(item!).getByText("宋清扬与方言读音不合")).toBeVisible();
    expect(within(item!).getByText("排除时间")).toBeVisible();
    expect(within(item!).getByRole("time")).toHaveAttribute(
      "datetime",
      "2026-10-16T02:30:00.000Z",
    );

    await user.click(within(item!).getByRole("button", { name: "恢复宋清扬到候选池" }));
    expect(restore).toHaveBeenCalledWith("1", "2026-10-16T02:31.000Z");
  });

  it("calls the session undo callback and follows its remaining availability", async () => {
    const undo = vi.fn().mockResolvedValue(false);
    const user = userEvent.setup();
    render(
      <ExcludedCandidatesSection
        canUndo
        candidates={candidates}
        onClear={vi.fn()}
        onRestore={vi.fn()}
        onUndo={undo}
      />,
    );

    const button = screen.getByRole("button", {
      name: "撤销本次会话最近一次名字操作",
    });
    await user.click(button);
    expect(undo).toHaveBeenCalledOnce();
    expect(button).toBeDisabled();
  });

  it("only permanently clears checked names after the exact count is entered", async () => {
    const clear = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <ExcludedCandidatesSection candidates={candidates} onClear={clear} onRestore={vi.fn()} />,
    );

    await user.click(screen.getByLabelText("选择永久清空宋清扬"));
    await user.click(screen.getByLabelText("选择永久清空宋知远"));
    expect(screen.getByText("已勾选 2 个")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "永久清空已勾选的 2 个名字" }));

    const dialog = screen.getByRole("dialog", { name: "确认永久清空" });
    expect(within(dialog).getByText("这项操作无法撤销。")).toBeVisible();
    const confirm = within(dialog).getByRole("button", { name: "确认永久删除 2 个名字" });
    const count = within(dialog).getByLabelText("输入数字 2 以确认");
    await user.type(count, "1");
    expect(confirm).toBeDisabled();
    await user.clear(count);
    await user.type(count, "2");
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    expect(clear).toHaveBeenCalledWith(
      [
        { candidateId: "1", expectedUpdatedAt: "2026-10-16T02:31.000Z" },
        { candidateId: "2", expectedUpdatedAt: "2026-10-16T02:32.000Z" },
      ],
      2,
    );
    expect(screen.queryByRole("dialog", { name: "确认永久清空" })).not.toBeInTheDocument();
  });

  it("describes the destructive effect in text and keeps actions at accessible sizes", () => {
    render(
      <ExcludedCandidatesSection
        candidates={candidates}
        onClear={vi.fn()}
        onRestore={vi.fn()}
      />,
    );

    expect(screen.getByText("永久清空会删除完整名字资料")).toBeVisible();
    expect(screen.getByText(/来源、评分、评价和操作历史会一并删除/)).toBeVisible();
    expect(screen.getByRole("button", { name: "恢复宋清扬到候选池" })).toHaveClass("ui-button");
    expect(screen.getByRole("button", { name: /永久清空已勾选/ })).toHaveClass(
      "excluded-candidates__clear-trigger",
    );
  });
});
