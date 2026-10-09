import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import {
  CandidateFunnelPage,
  type FunnelCandidate,
} from "../../../../src/features/funnel/CandidateFunnelPage";
import { namingProfileFixture } from "../../../fixtures/namingProfile";
const candidate: FunnelCandidate = {
  id: "c1",
  givenName: "清扬",
  fullName: "宋清扬",
  pinyin: ["qīng", "yáng"],
  sourceType: "verified_allusion",
  summary: "清朗明亮",
  stage: "inbox",
  systemScore: 84,
  warnings: [],
  characterEvidence: [
    { char: "清", pinyin: ["qīng"], meanings: ["清澈"], sourceRefs: ["standard-hanzi-2013"] },
  ],
  sourceEvidence: [
    { sourceId: "chinese-poetry:shijing", work: "诗经", quote: "有美一人，清扬婉兮。" },
  ],
};
describe("same-page inspiration and shortlist", () => {
  it("keeps generated inspirations outside the shortlist until explicitly chosen", async () => {
    const favorite = vi.fn();
    const user = userEvent.setup();
    render(<CandidateFunnelPage candidates={[candidate]} onFavorite={favorite} />);
    await user.click(screen.getByRole("button", { name: /^基础候选/ }));
    expect(screen.queryByRole("heading", { name: "宋清扬" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /灵感池/ }));
    await user.click(screen.getByRole("button", { name: "保留到基础候选宋清扬" }));
    expect(favorite).toHaveBeenCalledWith("c1");
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "把喜欢的名字，慢慢留下" })).toHaveFocus(),
    );
    expect(screen.queryByRole("heading", { name: "宋清扬" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^基础候选/ }));
    expect(screen.getByRole("heading", { name: "宋清扬" })).toBeVisible();
  });
  it("shows and sorts the unified system score independently from personal ratings", () => {
    render(
      <CandidateFunnelPage
        candidates={[
          candidate,
          { ...candidate, id: "c2", fullName: "宋知远", systemScore: 92, rating: 1 },
        ]}
        onFavorite={vi.fn()}
      />,
    );

    const list = screen.getByRole("region", { name: "名字列表" });
    expect(
      within(list)
        .getAllByRole("heading", { level: 2 })
        .map((item) => item.textContent),
    ).toEqual(["宋知远", "宋清扬"]);
    expect(screen.getByText("系统匹配 92/100")).toBeVisible();
    expect(screen.getByText("系统匹配 84/100")).toBeVisible();
  });
  it("does not lose an inspiration when saving fails", async () => {
    const user = userEvent.setup();
    render(
      <CandidateFunnelPage
        candidates={[candidate]}
        onFavorite={vi.fn().mockRejectedValue(new Error("磁盘不可写"))}
      />,
    );
    await user.click(screen.getByRole("button", { name: "保留到基础候选宋清扬" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("磁盘不可写");
    expect(screen.getByRole("heading", { name: "宋清扬" })).toBeVisible();
  });
  it("supports exclusion with a reason, restoration and undo", async () => {
    const move = vi.fn();
    const undo = vi.fn().mockResolvedValue(false);
    const user = userEvent.setup();
    render(
      <CandidateFunnelPage
        candidates={[candidate]}
        onFavorite={vi.fn()}
        onMove={move}
        onUndo={undo}
      />,
    );
    await user.click(screen.getByText("排除这个名字"));
    await user.type(screen.getByLabelText("排除理由宋清扬"), "家人方言不合适");
    await user.click(screen.getByRole("button", { name: "排除", exact: true }));
    expect(move).toHaveBeenCalledWith("c1", "excluded", "家人方言不合适");
    await user.click(screen.getByRole("button", { name: /已排除.*1/ }));
    await user.click(screen.getByRole("button", { name: "恢复到候选池" }));
    expect(move).toHaveBeenLastCalledWith("c1", "inbox", undefined);
    await user.click(screen.getByRole("button", { name: "撤销上一步" }));
    expect(undo).toHaveBeenCalledOnce();
  });
  it("shows traceable meaning in an accessible closeable dialog", async () => {
    const user = userEvent.setup();
    render(<CandidateFunnelPage candidates={[candidate]} onFavorite={vi.fn()} />);
    const open = screen.getByRole("button", { name: "查看宋清扬详情" });
    await user.click(open);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("逐字读懂")).toBeVisible();
    expect(within(dialog).getByText(/清扬婉兮/)).toBeVisible();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(open).toHaveFocus();
  });
  it("bounds rendering and searches the entire inspiration pool", async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 180 }, (_, i) => ({
      ...candidate,
      id: `c${i}`,
      fullName: `宋清扬${i}`,
    }));
    render(<CandidateFunnelPage candidates={many} onFavorite={vi.fn()} />);
    expect(screen.getAllByRole("button", { name: /保留到基础候选宋/ })).toHaveLength(9);
    await user.click(screen.getByRole("button", { name: "显示更多历史灵感" }));
    expect(screen.getAllByRole("button", { name: /保留到基础候选宋/ })).toHaveLength(18);
    await user.type(screen.getByLabelText("搜索姓名"), "179");
    expect(screen.getByRole("heading", { name: "宋清扬179" })).toBeVisible();
  });

  it("focuses a newly generated batch and keeps the full inspiration history available", async () => {
    const user = userEvent.setup();
    const batches = Array.from({ length: 18 }, (_, index) => ({
      ...candidate,
      id: `c${index}`,
      fullName: `宋灵感${index}`,
      batchId: index < 9 ? "batch-1" : "batch-2",
      createdAt: index < 9 ? "2026-10-08T00:00:00.000Z" : "2026-10-09T00:00:00.000Z",
    }));
    const generateMore = vi.fn().mockResolvedValue(undefined);

    const view = render(
      <CandidateFunnelPage
        candidates={batches}
        latestGeneratedBatchId="batch-2"
        onFavorite={vi.fn()}
        onGenerateMore={generateMore}
      />,
    );

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("筛选结果 9 条，当前显示 9 条"),
    );
    expect(screen.getByRole("heading", { name: "宋灵感9" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "宋灵感0" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "最新一批" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "全部灵感" }));
    expect(screen.getByRole("button", { name: "显示更多历史灵感" })).toBeVisible();
    view.rerender(
      <CandidateFunnelPage
        candidates={batches}
        onFavorite={vi.fn()}
        onGenerateMore={generateMore}
      />,
    );
    await user.click(screen.getByRole("button", { name: "最新一批" }));
    expect(screen.getByRole("heading", { name: "宋灵感9" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "宋灵感0" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "再生成一批" }));
    expect(generateMore).toHaveBeenCalledOnce();
  });
  it("saves rating and note for chosen names", async () => {
    const user = userEvent.setup();
    const evaluate = vi.fn();
    render(
      <CandidateFunnelPage
        candidates={[{ ...candidate, stage: "basic_shortlist" }]}
        onFavorite={vi.fn()}
        onEvaluate={evaluate}
      />,
    );
    await user.click(screen.getByRole("button", { name: /^基础候选/ }));
    await user.selectOptions(screen.getByLabelText("评分宋清扬"), "5");
    await user.type(screen.getByLabelText("备注宋清扬"), "喜欢字义");
    await user.tab();
    expect(evaluate).toHaveBeenLastCalledWith("c1", 5, "喜欢字义");
  });

  it("does not open comparison until at least two names are in the comparison pool", async () => {
    const user = userEvent.setup();
    render(
      <CandidateFunnelPage
        candidates={[{ ...candidate, stage: "basic_shortlist" }]}
        onFavorite={vi.fn()}
        onOpenComparison={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^基础候选/ }));

    expect(screen.getByRole("button", { name: "请先加入重点候选" })).toBeDisabled();
  });

  it("moves one basic candidate through folklore into the important pool", async () => {
    const move = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <CandidateFunnelPage
        candidates={[{ ...candidate, stage: "basic_shortlist" }]}
        onFavorite={vi.fn()}
        onMove={move}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^基础候选/ }));
    await user.click(screen.getByRole("button", { name: "下一步：进入民俗候选" }));
    expect(move).toHaveBeenCalledWith("c1", "folklore_review", undefined);
    expect(screen.getByRole("button", { name: /^基础候选.*1$/ })).toBeVisible();

    await user.click(screen.getByRole("button", { name: /^民俗候选/ }));
    expect(screen.getByRole("region", { name: "民俗筛选结果" })).toHaveTextContent(
      "传统参考暂不可判断",
    );
    await user.click(screen.getByRole("button", { name: "加入重点候选" }));
    expect(move).toHaveBeenLastCalledWith("c1", "comparison", undefined);
  });

  it("keeps downstream names visible in the cumulative basic and folklore pools", async () => {
    const user = userEvent.setup();
    render(
      <CandidateFunnelPage
        initialStage="basic"
        candidates={[
          { ...candidate, id: "basic", fullName: "宋基础", stage: "basic_shortlist" },
          { ...candidate, id: "folk", fullName: "宋民俗", stage: "folklore_review" },
          { ...candidate, id: "direct", fullName: "宋直入", stage: "comparison" },
          {
            ...candidate,
            id: "reviewed",
            fullName: "宋已审",
            stage: "comparison",
            folkloreReviewed: true,
          },
          {
            ...candidate,
            id: "final",
            fullName: "宋定稿",
            stage: "finalist",
            folkloreReviewed: true,
          },
        ]}
        onFavorite={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /^基础候选.*5$/ })).toBeVisible();
    for (const name of ["宋基础", "宋民俗", "宋直入", "宋已审", "宋定稿"])
      expect(screen.getByRole("heading", { name })).toBeVisible();

    await user.click(screen.getByRole("button", { name: /^民俗候选.*3$/ }));
    for (const name of ["宋民俗", "宋已审", "宋定稿"])
      expect(screen.getByRole("heading", { name })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "宋直入" })).not.toBeInTheDocument();
  });

  it("keeps folklore settings and explanations inside the folklore stage", async () => {
    const user = userEvent.setup();
    const profile = {
      ...namingProfileFixture(),
      folklore: {
        enabled: true,
        usefulElements: ["water" as const],
        includeInRanking: true,
      },
    };
    render(
      <CandidateFunnelPage
        initialStage="basic"
        candidates={[{ ...candidate, stage: "folklore_review" }]}
        folkloreControls={<p>民俗阶段专属设置</p>}
        onFavorite={vi.fn()}
        profile={profile}
      />,
    );

    expect(screen.queryByText("民俗阶段专属设置")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "查看宋清扬详情" }));
    expect(screen.queryByText("这个名字的民俗解释")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "关闭详情" }));

    await user.click(screen.getByRole("button", { name: /^民俗候选/ }));
    expect(screen.getByText("民俗阶段专属设置")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "查看宋清扬详情" }));
    expect(await screen.findByText("这个名字的民俗解释")).toBeVisible();
  });

  it("blocks progression while family rules are still unknown", async () => {
    const resolve = vi.fn();
    const user = userEvent.setup();
    render(
      <CandidateFunnelPage
        candidates={[{ ...candidate, stage: "basic_shortlist" }]}
        onFavorite={vi.fn()}
        onMove={vi.fn()}
        onOpenComparison={vi.fn()}
        onResolveConstraints={resolve}
        progressionBlocked
      />,
    );

    await user.click(screen.getByRole("button", { name: /^基础候选/ }));
    expect(screen.getByRole("button", { name: "下一步：进入民俗候选" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "跳过民俗，加入重点候选" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "进入重点前先核对家庭规则" }));
    expect(resolve).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "请先核对家庭规则" })).toBeDisabled();
  });

  it("previews automatic filtering and only moves overflow names to the previous pool", async () => {
    const apply = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    const basics = Array.from({ length: 6 }, (_, index) => ({
      ...candidate,
      id: `c${index}`,
      fullName: `宋候选${5 - index}`,
      stage: "basic_shortlist" as const,
      systemScore: 90 - index,
      decisionUpdatedAt: `2026-10-08T00:00:0${index}.000Z`,
    }));
    const folklore = {
      ...candidate,
      id: "folklore-1",
      fullName: "宋民俗",
      stage: "folklore_review" as const,
      systemScore: 1,
      decisionUpdatedAt: "2026-10-08T00:00:10.000Z",
    };
    render(
      <CandidateFunnelPage
        candidates={[...basics, folklore]}
        initialStage="basic"
        onApplyAutoFilter={apply}
        onFavorite={vi.fn()}
        onMove={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /^基础候选.*7$/ })).toBeVisible();
    expect(screen.getByRole("heading", { name: "宋民俗" })).toBeVisible();
    await user.selectOptions(screen.getByLabelText("候选排序"), "name");
    await user.click(screen.getByRole("button", { name: "预览自动筛选" }));
    expect(screen.getByText(/移除 1 个到灵感池/)).toBeVisible();
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === "LI" &&
          Boolean(element.textContent?.includes("宋候选0")) &&
          Boolean(element.textContent?.includes("固定排序第 6")),
      ),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "确认应用本阶段筛选" }));
    await waitFor(() =>
      expect(apply).toHaveBeenCalledWith({
        moves: [
          {
            candidateId: "c5",
            from: "basic_shortlist",
            to: "inbox",
            expectedUpdatedAt: "2026-10-08T00:00:05.000Z",
          },
        ],
      }),
    );
  });
});
