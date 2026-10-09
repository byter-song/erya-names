import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FinalizationPage } from "../../../../src/features/finalization/FinalizationPage";

const candidates = [
  { id: "c1", fullName: "宋清扬", summary: "清秀明朗", rating: 5 },
  { id: "c2", fullName: "宋知远", summary: "志向高远", rating: 4 },
];

describe("FinalizationPage", () => {
  it("keeps multiple names and exports the current list", async () => {
    const onExport = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <FinalizationPage
        candidates={candidates}
        onExclude={vi.fn()}
        onExport={onExport}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "定稿名单" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "宋清扬" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "宋知远" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "导出定稿名单" }));
    expect(onExport).toHaveBeenCalledOnce();
    expect(await screen.findByRole("status")).toHaveTextContent(
      "定稿名单已导出；当前名单仍可继续调整",
    );
  });

  it("moves one name back to the important pool", async () => {
    const onRemove = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <FinalizationPage
        candidates={candidates}
        onExclude={vi.fn()}
        onExport={vi.fn()}
        onRemove={onRemove}
      />,
    );

    await user.click(screen.getAllByRole("button", { name: "移除到重点候选" })[0]!);
    expect(onRemove).toHaveBeenCalledWith("c1");
  });

  it("excludes one name with an optional reason", async () => {
    const onExclude = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <FinalizationPage
        candidates={candidates}
        onExclude={onExclude}
        onExport={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    await user.click(screen.getAllByText("排除这个名字")[0]!);
    await user.type(screen.getByLabelText("排除理由宋清扬"), "家人暂不考虑");
    await user.click(screen.getAllByRole("button", { name: "排除" })[0]!);
    expect(onExclude).toHaveBeenCalledWith("c1", "家人暂不考虑");
  });

  it("shows a legacy single-name decision as read-only history", () => {
    render(
      <FinalizationPage
        candidates={candidates}
        legacyDecision={{
          selectedCandidateId: "c1",
          selectedCandidateName: "宋清扬",
          rationale: "旧版本决定理由",
          updatedAt: "2026-09-18T00:00:00.000Z",
        }}
        onExclude={vi.fn()}
        onExport={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByRole("region", { name: "历史单一定稿记录" })).toHaveTextContent(
      "宋清扬",
    );
    expect(screen.getByText("旧版本决定理由")).toBeVisible();
  });
});
