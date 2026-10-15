import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { InkLongScrollPage } from "../../src/features/scroll/InkLongScrollPage";
import { namingProfileFixture } from "../fixtures/namingProfile";
import type { CandidateFunnelItem } from "../../src/application/models/CandidateFunnelItem";
import { zodiacAdvisory } from "../../src/domain/folklore/zodiacAdvisory";
import { generateCandidates } from "../../src/domain/generation/generateCandidates";
import { historicalInspirationDrafts } from "../../src/domain/generation/historicalInspiration";
import { runtimeBundleSchema } from "../../src/data/schema/runtimeBundle";
import personal from "../../src/data/curated/personal-bundle.json";
const bundle = runtimeBundleSchema.parse(personal);
const profile = { ...namingProfileFixture(), constraintKnowledge: "none" as const };
const candidate: CandidateFunnelItem = {
  id: "c1",
  fullName: "宋清扬",
  givenName: "清扬",
  pinyin: ["qīng", "yáng"],
  sourceType: "modern_combination",
  summary: "清朗",
  stage: "inbox",
  warnings: [],
};
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
function props() {
  return {
    profile,
    candidates: [
      candidate,
      { ...candidate, id: "c2", fullName: "宋清和", stage: "excluded" as const },
    ],
    datasetVersion: "test",
    generationBusy: false,
    onGenerate: vi.fn().mockResolvedValue(undefined),
    onMove: vi.fn().mockResolvedValue(undefined),
    onEvaluate: vi.fn().mockResolvedValue(undefined),
    onUndo: vi.fn().mockResolvedValue(true),
    onAddManual: vi.fn().mockResolvedValue(undefined),
    onOpenComparison: vi.fn(),
    onOpenFinalization: vi.fn(),
    conditions: <p>条件</p>,
    folkloreSettings: <p>民俗</p>,
    chapter: "inbox" as const,
    onChapterChange: vi.fn(),
  };
}
describe("long scroll decisions", () => {
  it("filters chapters, opens keyboard-accessible details and restores focus on Escape", async () => {
    const user = userEvent.setup();
    const p = props();
    render(<InkLongScrollPage {...p} />);
    expect(screen.queryByText("宋清和")).not.toBeInTheDocument();
    const trigger = screen.getByRole("button", { name: "查看宋清扬详情" });
    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "宋清扬详情" })).toBeVisible();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "保留到基础候选" }));
    expect(p.onMove).toHaveBeenCalledWith("c1", "basic_shortlist");
  });
  it("shows failed generation and lets the user retry", async () => {
    const user = userEvent.setup();
    const p = props();
    p.onGenerate.mockRejectedValueOnce(new Error("生成暂不可用"));
    render(<InkLongScrollPage {...p} candidates={[]} />);
    await user.click(screen.getByRole("button", { name: "展卷 · 生成 9 个名字" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("生成暂不可用");
    await user.click(screen.getByRole("button", { name: "展卷 · 生成 9 个名字" }));
    await waitFor(() => expect(p.onGenerate).toHaveBeenCalledTimes(2));
  });
});
describe("inspiration and folklore separation", () => {
  it("turns the reviewed new dynasties into historical inspiration drafts", () => {
    const drafts = historicalInspirationDrafts(
      { ...profile, inspirationSources: ["historical"] },
      bundle,
    );
    const titles = drafts.flatMap((draft) =>
      draft.sourceEvidence.map((evidence) => evidence.title),
    );

    expect(titles).toContain("吕蒙正 · 状元用名");
    expect(titles).toContain("泰不华 · 状元用名");
    expect(titles).toContain("赵秉忠 · 状元用名");
    expect(titles).toContain("王云锦 · 状元用名");
    expect(titles).toContain("林召棠 · 状元用名");
    expect(titles).not.toContain("卢肇 · 状元用名");
  });
  it("generates sourced historical inspirations without bypassing the current family constraints", () => {
    const input = {
      profile: { ...profile, inspirationSources: ["historical" as const] },
      bundle,
      seed: "historical",
      requestedCount: 9,
      allusionRatio: 0.5,
      historicalFingerprints: new Set<string>(),
    };
    const result = generateCandidates(input);
    expect(result.candidates.length).toBeGreaterThan(0);
    for (const c of result.candidates) {
      expect(c.sourceType).toBe("historical_inspiration");
      expect(c.sourceEvidence[0]?.excerpt).toContain("关系：");
      expect(c.sourceEvidence[0]?.url).toMatch(/^https:/);
    }
    const avoided = result.candidates[0]!.givenName[0]!;
    const filtered = generateCandidates({
      ...input,
      profile: { ...input.profile, avoidCharacters: [avoided] },
    });
    expect(filtered.candidates.every((c) => !c.givenName.includes(avoided))).toBe(true);
  });
  it("adds explicit zodiac prefix advice without changing names, ordering or scores", () => {
    const base = {
      ...profile,
      folklore: {
        ...profile.folklore,
        enabled: true,
        birthLocalDateTime: "2026-05-12T10:00",
        timeZone: "Asia/Shanghai",
      },
    };
    const withAdvice = {
      ...base,
      folklore: {
        ...base.folklore,
        zodiacRules: [
          {
            zodiac: "马" as const,
            characters: "清",
            position: "start" as const,
            explanation: "家庭首字提醒",
            source: "家人口述",
          },
        ],
      },
    };
    expect(zodiacAdvisory("清扬", withAdvice.folklore).hits).toHaveLength(1);
    expect(zodiacAdvisory("扬清", withAdvice.folklore).hits).toHaveLength(0);
    const options = {
      bundle,
      seed: "same",
      requestedCount: 9,
      allusionRatio: 0.5,
      historicalFingerprints: new Set<string>(),
    };
    expect(generateCandidates({ ...options, profile: withAdvice })).toEqual(
      generateCandidates({ ...options, profile: base }),
    );
  });
});
