import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import {
  CandidateFunnelPage,
  type FunnelCandidate,
} from "../../../../src/features/funnel/CandidateFunnelPage";
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
    await user.click(screen.getByRole("button", { name: /我的候选/ }));
    expect(screen.queryByRole("heading", { name: "宋清扬" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /灵感池/ }));
    await user.click(screen.getByRole("button", { name: "收入候选宋清扬" }));
    expect(favorite).toHaveBeenCalledWith("c1");
    expect(screen.queryByRole("heading", { name: "宋清扬" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /我的候选/ }));
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
    await user.click(screen.getByRole("button", { name: "收入候选宋清扬" }));
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
    await user.click(screen.getByText("暂不考虑这个名字"));
    await user.type(screen.getByLabelText("淘汰理由宋清扬"), "家人方言不合适");
    await user.click(screen.getByRole("button", { name: "暂不考虑", exact: true }));
    expect(move).toHaveBeenCalledWith("c1", "rejected", "家人方言不合适");
    await user.click(screen.getByRole("button", { name: /暂不考虑.*1/ }));
    await user.click(screen.getByRole("button", { name: "恢复到灵感池" }));
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
    expect(screen.getAllByRole("button", { name: /收入候选宋/ })).toHaveLength(48);
    await user.click(screen.getByRole("button", { name: "显示更多名字" }));
    expect(screen.getAllByRole("button", { name: /收入候选宋/ })).toHaveLength(96);
    await user.type(screen.getByLabelText("搜索姓名"), "179");
    expect(screen.getByRole("heading", { name: "宋清扬179" })).toBeVisible();
  });
  it("saves rating and note for chosen names", async () => {
    const user = userEvent.setup();
    const evaluate = vi.fn();
    render(
      <CandidateFunnelPage
        candidates={[{ ...candidate, stage: "favorite" }]}
        onFavorite={vi.fn()}
        onEvaluate={evaluate}
      />,
    );
    await user.click(screen.getByRole("button", { name: /我的候选/ }));
    await user.selectOptions(screen.getByLabelText("评分宋清扬"), "5");
    await user.type(screen.getByLabelText("备注宋清扬"), "喜欢字义");
    await user.tab();
    expect(evaluate).toHaveBeenLastCalledWith("c1", 5, "喜欢字义");
  });
});
