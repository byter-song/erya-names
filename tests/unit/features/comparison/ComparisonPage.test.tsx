import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ComparisonPage } from "../../../../src/features/comparison/ComparisonPage";

const candidates = [
  {
    id: "c1",
    fullName: "宋清扬",
    pinyin: ["sòng", "qīng", "yáng"],
    sourceType: "verified_allusion" as const,
    summary: "清秀明朗",
    stage: "comparison" as const,
    warnings: [],
    rating: 5,
    note: "喜欢",
    folkloreReviewed: true,
    sourceEvidence: [{ sourceId: "shijing", work: "诗经", quote: "有美一人" }],
    ruleEvidence: [
      {
        evidenceLevel: "L3" as const,
        outcome: "pass" as const,
        ruleId: "l3-shape-balance",
        ruleVersion: "1",
        explanation: "字形结构舒展",
        sourceRefs: [],
        scoreDelta: 2,
      },
      {
        evidenceLevel: "L4" as const,
        outcome: "pass" as const,
        ruleId: "l4-useful-elements",
        ruleVersion: "1",
        explanation: "包含用户指定喜用五行",
        sourceRefs: [],
        scoreDelta: 1,
      },
    ],
  },
  {
    id: "c2",
    fullName: "宋知远",
    pinyin: ["sòng", "zhī", "yuǎn"],
    sourceType: "verified_allusion" as const,
    summary: "志向高远",
    stage: "comparison" as const,
    warnings: [],
    rating: 4,
  },
  {
    id: "c3",
    fullName: "宋嘉树",
    pinyin: ["sòng", "jiā", "shù"],
    sourceType: "verified_allusion" as const,
    summary: "坚定成长",
    stage: "comparison" as const,
    warnings: [],
  },
];

describe("ComparisonPage", () => {
  it("offers a direct way back when no names have entered comparison", async () => {
    const back = vi.fn();
    const user = userEvent.setup();
    render(<ComparisonPage candidates={[]} onBackToCandidates={back} onPromote={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "返回我的候选" }));
    expect(back).toHaveBeenCalledOnce();
  });

  it("compares candidates and promotes one to finalist", async () => {
    const promote = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ComparisonPage candidates={candidates} onPromote={promote} />);

    expect(screen.getByRole("heading", { name: "重点候选" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "宋清扬" })).toBeVisible();
    expect(screen.getByText("5 分")).toBeVisible();
    expect(screen.getByText("喜欢")).toBeVisible();
    expect(screen.getAllByText("诗经 · 有美一人")).toHaveLength(2);
    expect(screen.getAllByText("读音与叫名").length).toBeGreaterThan(0);
    expect(screen.getAllByText("书写难度").length).toBeGreaterThan(0);
    expect(screen.getAllByText("传统民俗参考").length).toBeGreaterThan(0);
    expect(screen.getAllByText("已复筛")).toHaveLength(2);
    await user.click(screen.getByText("查看评分与技术依据"));
    expect(screen.getByText("字形结构舒展")).toBeVisible();
    expect(screen.getByText("包含用户指定喜用五行")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "将宋清扬加入定稿名单" }));
    expect(promote).toHaveBeenCalledWith("c1");
  });

  it("keeps the comparison snapshot stable while candidates are promoted in sequence", async () => {
    const promote = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ComparisonPage candidates={candidates} onPromote={promote} />);

    await user.click(screen.getByRole("button", { name: "将宋清扬加入定稿名单" }));

    expect(screen.getAllByRole("button", { name: "宋清扬已加入定稿名单" })).toHaveLength(2);
    for (const button of screen.getAllByRole("button", {
      name: "宋清扬已加入定稿名单",
    }))
      expect(button).toBeDisabled();
    expect(screen.getByRole("button", { name: "将宋知远加入定稿名单" })).toBeEnabled();
    expect(screen.getByRole("heading", { name: "宋清扬" })).toBeVisible();
  });

  it("saves an immutable snapshot for a valid comparison set", async () => {
    const saveSnapshot = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <ComparisonPage
        candidates={candidates}
        onPromote={vi.fn()}
        onSaveSnapshot={saveSnapshot}
      />,
    );
    await user.clear(screen.getByLabelText("快照名称"));
    await user.type(screen.getByLabelText("快照名称"), "第二轮");
    await user.click(screen.getByRole("button", { name: "保存对比快照" }));
    expect(saveSnapshot).toHaveBeenCalledWith(candidates, "第二轮");
  });

  it("opens a saved historical snapshot without reading current candidate values", async () => {
    const user = userEvent.setup();
    render(
      <ComparisonPage
        candidates={candidates}
        onPromote={vi.fn()}
        snapshots={[
          {
            id: "snapshot-old",
            projectId: "p1",
            name: "第一轮",
            candidateIds: ["old-1", "old-2"],
            candidates: [
              {
                ...candidates[0]!,
                id: "old-1",
                sourceEvidence: [],
                ruleEvidence: candidates[0]!.ruleEvidence ?? [],
                rating: 2,
                note: "旧评价",
              },
              {
                ...candidates[1]!,
                id: "old-2",
                sourceEvidence: [],
                ruleEvidence: [],
                rating: 3,
              },
            ],
            createdAt: "2026-09-18T00:00:00.000Z",
          },
        ]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "查看第一轮" }));
    expect(screen.getByRole("dialog", { name: "第一轮" })).toHaveTextContent("旧评价");
    expect(screen.getByRole("dialog", { name: "第一轮" })).toHaveTextContent("2 分");
  });

  it("lets the user open a final list with one or more names", async () => {
    const openFinalization = vi.fn();
    const user = userEvent.setup();
    render(
      <ComparisonPage
        candidates={[candidates[0]!]}
        finalists={[candidates[1]!].map((candidate) => ({
          ...candidate,
          stage: "finalist" as const,
        }))}
        onOpenFinalization={openFinalization}
        onPromote={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    await user.click(screen.getByRole("button", { name: "查看定稿名单" }));
    expect(openFinalization).toHaveBeenCalledOnce();
  });

  it("offers session undo for a finalist promotion", async () => {
    const undo = vi.fn().mockResolvedValue(false);
    const user = userEvent.setup();
    render(
      <ComparisonPage
        candidates={candidates}
        onPromote={vi.fn().mockResolvedValue(undefined)}
        onUndo={undo}
      />,
    );
    await user.click(screen.getByRole("button", { name: "将宋清扬加入定稿名单" }));
    await user.click(screen.getByRole("button", { name: "撤销上一步" }));
    expect(undo).toHaveBeenCalledOnce();
  });

  it("keeps persisted finalists visible when the comparison queue is empty after reload", async () => {
    const openFinalization = vi.fn();
    const returnToComparison = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <ComparisonPage
        candidates={[]}
        finalists={candidates.map((candidate) => ({
          ...candidate,
          stage: "finalist" as const,
        }))}
        onOpenFinalization={openFinalization}
        onPromote={vi.fn()}
        onReturnToComparison={returnToComparison}
      />,
    );

    expect(screen.getByRole("region", { name: "定稿名单" })).toHaveTextContent(
      "定稿名单 3 / 5",
    );
    expect(
      screen.getByText("重点候选已处理完。上方定稿名单仍然完整保存，可继续调整。"),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "查看定稿名单" }));
    expect(openFinalization).toHaveBeenCalledOnce();
    await user.click(screen.getAllByRole("button", { name: "移除到重点候选" })[0]!);
    expect(returnToComparison).toHaveBeenCalledWith("c1");
  });
});
