import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import devBundle from "../../../../src/data/curated/dev-bundle.json";
import { initializeRuntimeBundle } from "../../../../src/data/activeRuntimeBundle";
import { NameExplanation } from "../../../../src/features/insights/NameExplanation";
import type { CandidateFunnelItem } from "../../../../src/application/models/CandidateFunnelItem";
import type { RuleEvidence } from "../../../../src/domain/rules/result";
import { namingProfileFixture } from "../../../fixtures/namingProfile";

const candidate: CandidateFunnelItem = {
  id: "candidate-wang-anshi",
  givenName: "安石",
  fullName: "王安石",
  pinyin: ["ān", "shí"],
  sourceType: "user_input",
  summary: "手工加入的名字",
  sourceEvidence: [],
  pool: "favorite",
  decisionUpdatedAt: "2026-10-16T00:00:00.000Z",
  scoringPending: false,
  hardStatus: "pass",
  totalScore: 92,
  completeness: 1,
  moduleScores: { basic: 92 },
  topDeductions: [],
  hiddenScoredModuleCount: 0,
};

const evidence: RuleEvidence[] = [
  {
    id: "evidence-tone",
    projectId: "project-1",
    candidateId: candidate.id,
    moduleId: "basic",
    dimensionId: "sound",
    ruleId: "basic.sound.repeat",
    ruleVersion: "1.0.0",
    severity: "soft",
    status: "notice",
    applicability: "applied",
    scoreBefore: 100,
    deduction: 4,
    scoreAfter: 96,
    explanation: "两个字的音节相近，朗读时需要留意辨识度。",
    inputSummary: "ān / shí",
    inputHash: "hash-1",
    calculation: ["启用拼音友好检查。", "相近音节命中一项，扣 4 分。"],
    sourceIds: ["gb-pinyin"],
    uncertainty: "方言读音未纳入自动判断。",
  },
  {
    id: "evidence-zodiac",
    projectId: "project-1",
    candidateId: candidate.id,
    moduleId: "zodiac",
    dimensionId: "radical",
    ruleId: "zodiac.radical",
    ruleVersion: "1.0.0",
    schoolId: "folk-reference",
    severity: "soft",
    status: "unknown",
    applicability: "source_unverified",
    explanation: "生肖字根资料尚未完成复核。",
    inputSummary: "生肖：龙",
    inputHash: "hash-1",
    calculation: ["资料未复核，因此退出评分分母。"],
    sourceIds: [],
  },
];

afterEach(() => {
  initializeRuntimeBundle(devBundle);
});

describe("NameExplanation person usage", () => {
  it("shows an exact historical-name match with a neutral disclaimer", () => {
    initializeRuntimeBundle({
      ...devBundle,
      personUsages: [
        {
          id: "person:Q319618",
          name: "王安石",
          period: "北宋（1021—1086）",
          identityType: "historical_person",
          description: "北宋政治家、文学家、思想家。",
          sourceRefs: [
            {
              sourceId: "wikidata-person-usage",
              location: "Wikidata Q319618",
              url: "https://www.wikidata.org/wiki/Q319618",
            },
          ],
          reviewStatus: "source_checked",
          checkedAt: "2026-09-30",
        },
      ],
    });

    render(<NameExplanation candidate={candidate} />);

    expect(screen.getByRole("heading", { name: "历史用名参考" })).toBeVisible();
    expect(screen.getByText(/仅表示历史上存在完整同名记录/)).toHaveTextContent(
      "不参与评分和排序",
    );
    expect(screen.getByText(/北宋（1021—1086） · 历史人物/)).toBeVisible();
    expect(screen.getByRole("link", { name: "核对记录 ↗" })).toHaveAttribute(
      "href",
      "https://www.wikidata.org/wiki/Q319618",
    );
  });

  it("does not show a partial-name match", () => {
    initializeRuntimeBundle({
      ...devBundle,
      personUsages: [
        {
          id: "person:Q319618",
          name: "王安石",
          period: "北宋（1021—1086）",
          identityType: "historical_person",
          description: "北宋政治家、文学家、思想家。",
          sourceRefs: [{ sourceId: "wikidata-person-usage", location: "Wikidata Q319618" }],
          reviewStatus: "source_checked",
          checkedAt: "2026-09-30",
        },
      ],
    });

    render(<NameExplanation candidate={{ ...candidate, fullName: "安石" }} />);

    expect(screen.queryByRole("heading", { name: "历史用名参考" })).not.toBeInTheDocument();
  });

  it("shows an accessible evidence chain without relying on color", () => {
    render(
      <NameExplanation
        candidate={candidate}
        evidence={evidence}
        hiddenEvidenceCount={3}
        profile={namingProfileFixture()}
        showFolklore
      />,
    );

    expect(screen.getByRole("heading", { name: "规则证据与扣分过程" })).toBeVisible();
    expect(
      screen.getByText("另有 3 条证据已参与当前结果，但按方案的“详情显示”设置隐藏。"),
    ).toBeVisible();

    const appliedSummary = screen.getByText("状态：有提示").closest("summary");
    expect(appliedSummary).not.toBeNull();
    expect(appliedSummary?.parentElement).toHaveAttribute("class", "rule-evidence__item");

    const details = appliedSummary?.parentElement as HTMLDetailsElement;
    details.open = true;
    expect(screen.getByText("已应用")).toBeVisible();
    expect(screen.getByText("100 − 4 = 96")).toBeVisible();
    expect(screen.getByText("gb-pinyin")).toBeVisible();
    expect(screen.getByText("方言读音未纳入自动判断。")).toBeVisible();

    expect(screen.getByText("状态：暂无法判断")).toBeVisible();
    expect(screen.getByRole("heading", { name: "民俗分析总览" })).toBeVisible();
    expect(screen.getByText(/按当前方案选择的传统体系与流派计算/)).toBeVisible();
  });
});
