import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { CandidateFunnelItem } from "../../../../src/application/models/CandidateFunnelItem";
import { ComparisonPage } from "../../../../src/features/comparison/ComparisonPage";

describe("ComparisonPage", () => {
  it("renders every requested name without a five-name limit", () => {
    const candidates = Array.from({ length: 8 }, (_, index) =>
      candidate(`candidate-${index + 1}`, `宋候选${index + 1}`, {
        totalScore: 90 - index,
      }),
    );

    render(<ComparisonPage candidates={candidates} />);

    expect(screen.getByLabelText("共 8 个名字")).toBeVisible();
    const table = screen.getByRole("table");
    for (const item of candidates) expect(within(table).getByText(item.fullName)).toBeVisible();
    expect(within(table).getAllByRole("columnheader")).toHaveLength(9);
  });

  it("keeps comparison read-only while details are inspected", async () => {
    const user = userEvent.setup();
    const candidates = [
      candidate("candidate-1", "宋清扬", {
        pool: "candidate",
        note: "读起来清朗",
      }),
      candidate("candidate-2", "宋知远", {
        pool: "selected",
        hardStatus: "notice",
      }),
    ];
    const initialPools = candidates.map(({ id, pool, decisionUpdatedAt }) => ({
      id,
      pool,
      decisionUpdatedAt,
    }));

    render(<ComparisonPage candidates={candidates} />);

    expect(
      screen.getByText("比较仅供查看，不会改变名字所在池。", { exact: false }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /选择|移回|排除|恢复/ }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "查看宋清扬详情" }));
    expect(screen.getByRole("dialog", { name: "宋清扬详情" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "关闭" }));

    expect(
      candidates.map(({ id, pool, decisionUpdatedAt }) => ({ id, pool, decisionUpdatedAt })),
    ).toEqual(initialPools);
  });

  it("explains how to populate an empty comparison", () => {
    render(<ComparisonPage candidates={[]} />);

    expect(screen.getByRole("status")).toHaveTextContent("还没有加入对照的名字");
    expect(screen.getByRole("status")).toHaveTextContent("对照数量不设上限");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

function candidate(
  id: string,
  fullName: string,
  overrides: Partial<CandidateFunnelItem> = {},
): CandidateFunnelItem {
  return {
    id,
    givenName: fullName.slice(1),
    fullName,
    pinyin: ["qīng", "yáng"],
    sourceType: "modern_combination",
    summary: "清朗舒展",
    sourceEvidence: [],
    pool: "candidate",
    decisionUpdatedAt: "2026-10-16T00:00:00.000Z",
    scoringPending: false,
    hardStatus: "pass",
    totalScore: 88,
    completeness: 0.9,
    moduleScores: { basic: 88 },
    topDeductions: [
      {
        ruleId: "basic.sound.repeat",
        deduction: 2,
        explanation: "声调组合可再斟酌",
      },
    ],
    hiddenScoredModuleCount: 0,
    ...overrides,
  };
}
