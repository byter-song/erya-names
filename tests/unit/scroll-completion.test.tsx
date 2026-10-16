import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CandidateFunnelItem } from "../../src/application/models/CandidateFunnelItem";
import { InkLongScrollPage } from "../../src/features/scroll/InkLongScrollPage";
import { namingProfileFixture } from "../fixtures/namingProfile";

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  HTMLElement.prototype.scrollTo = function scrollTo(options?: ScrollToOptions | number) {
    this.scrollLeft = typeof options === "number" ? options : (options?.left ?? 0);
    this.dispatchEvent(new Event("scroll"));
  };
});

describe("long-scroll four-pool interaction", () => {
  it("renders only the center frame plus three neighbors on each side", async () => {
    const candidates = Array.from({ length: 12 }, (_, index) =>
      candidate(`c${index}`, `宋清${index}`, "inspiration", index),
    );
    render(<InkLongScrollPage {...props(candidates)} />);

    expect(document.querySelectorAll(".ils__panel")).toHaveLength(4);
    const scroller = screen.getByRole("region", { name: "横向名字长卷，左右方向键翻阅" });
    scroller.focus();
    await userEvent.keyboard("{End}");

    await waitFor(() => expect(screen.getByText("12 / 12")).toBeVisible());
    expect(document.querySelectorAll(".ils__panel")).toHaveLength(4);
    expect(screen.getByRole("heading", { name: "宋清11" })).toBeVisible();
  });

  it("keeps exclude at the lower left and select/remove actions on the right with names", async () => {
    const user = userEvent.setup();
    const p = props([candidate("c1", "宋清扬", "candidate", 0)]);
    render(<InkLongScrollPage {...p} chapter="candidate" />);
    const cardActions = screen.getByRole("region", { name: "宋清扬筛选操作" });

    expect(within(cardActions).getByRole("button", { name: "排除宋清扬" })).toHaveClass(
      "ils__card-action--exclude",
    );
    expect(
      within(cardActions).getByRole("button", { name: "移除宋清扬并返回上一阶段" }),
    ).toBeVisible();
    expect(
      within(cardActions).getByRole("button", { name: "选择宋清扬进入下一阶段" }),
    ).toBeVisible();

    await user.click(
      within(cardActions).getByRole("button", { name: "选择宋清扬进入下一阶段" }),
    );
    expect(p.onMove).toHaveBeenCalledWith("c1", "forward", "2026-10-16T00:00:00.000Z");
  });

  it("opens accessible details, restores focus on Escape, and reports generation failures", async () => {
    const user = userEvent.setup();
    const p = props([candidate("c1", "宋清扬", "inspiration", 0)]);
    const { rerender } = render(<InkLongScrollPage {...p} />);
    const trigger = screen.getByRole("button", { name: "查看宋清扬详情" });
    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "宋清扬详情" })).toBeVisible();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    p.onGenerate.mockRejectedValueOnce(new Error("生成暂不可用"));
    rerender(<InkLongScrollPage {...p} candidates={[]} />);
    await user.click(screen.getByRole("button", { name: "展卷 · 生成 9 个名字" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("生成暂不可用");
  });
});

function props(candidates: CandidateFunnelItem[]) {
  return {
    profile: namingProfileFixture(),
    candidates,
    generationBusy: false,
    onGenerate: vi.fn().mockResolvedValue(undefined),
    onMove: vi.fn().mockResolvedValue(undefined),
    onExclude: vi.fn().mockResolvedValue(undefined),
    onRestore: vi.fn().mockResolvedValue(undefined),
    onEvaluate: vi.fn().mockResolvedValue(undefined),
    onUndo: vi.fn().mockResolvedValue(true),
    onAddManual: vi.fn().mockResolvedValue(undefined),
    onOpenExport: vi.fn(),
    onOpenConfiguration: vi.fn(),
    chapter: "inspiration" as const,
    onChapterChange: vi.fn(),
  };
}

function candidate(
  id: string,
  fullName: string,
  pool: CandidateFunnelItem["pool"],
  ordinal: number,
): CandidateFunnelItem {
  return {
    id,
    createdAt: `2026-10-16T00:00:${String(ordinal).padStart(2, "0")}.000Z`,
    givenName: fullName.slice(1),
    fullName,
    pinyin: [],
    sourceType: "modern_combination",
    summary: "清朗自然",
    sourceEvidence: [],
    pool,
    decisionUpdatedAt: "2026-10-16T00:00:00.000Z",
    scoringPending: false,
    hardStatus: "pass",
    totalScore: 90 - ordinal,
    completeness: 1,
    moduleScores: { basic: 90 - ordinal },
    topDeductions: [],
    hiddenScoredModuleCount: 0,
    ...(pool === "excluded"
      ? {
          lastActivePool: "candidate" as const,
          exclusionReason: "暂不考虑",
          excludedAt: "2026-10-16T00:00:00.000Z",
        }
      : {}),
  };
}
