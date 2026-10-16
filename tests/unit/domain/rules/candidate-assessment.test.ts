import { describe, expect, it, vi } from "vitest";

import devBundle from "../../../../src/data/curated/dev-bundle.json";
import { runtimeBundleSchema } from "../../../../src/data/schema/runtimeBundle";
import type { CandidateScore } from "../../../../src/domain/rules/candidateScore";
import {
  CandidateAssessmentEngine,
  type CandidateAssessmentInput,
} from "../../../../src/domain/rules/CandidateAssessmentEngine";
import type { AggregateCandidateScoreInput } from "../../../../src/domain/rules/scoring/ScoreAggregator";
import { namingProfileFixture } from "../../../fixtures/namingProfile";

const bundle = runtimeBundleSchema.parse(devBundle);

describe("CandidateAssessmentEngine", () => {
  it("emits the basic eight dimensions and all five folklore modules as traceable evidence", () => {
    const result = new CandidateAssessmentEngine().assess(completeInput());
    const basicDimensions = new Set(
      result.evidence
        .filter(({ moduleId, severity }) => moduleId === "basic" && severity === "soft")
        .map(({ dimensionId }) => dimensionId),
    );

    expect([...basicDimensions]).toEqual([
      "standard_registration",
      "full_name_pronunciation",
      "meaning_combination",
      "source_quality",
      "writing_input",
      "style_expectation",
      "commonness_distinction",
      "dialect_pinyin",
    ]);
    expect(new Set(result.evidence.map(({ moduleId }) => moduleId))).toEqual(
      new Set(["basic", "bazi_wuxing", "zodiac", "traditional", "name_hexagram", "five_grids"]),
    );
    expect(
      result.evidence.every(
        ({ inputHash, sourceIds, calculation, inputSummary }) =>
          inputHash === "sha256:complete-input" &&
          sourceIds.length > 0 &&
          calculation.length > 0 &&
          inputSummary.length > 0,
      ),
    ).toBe(true);
    expect(
      result.evidence
        .filter(({ moduleId }) => moduleId !== "basic")
        .every(({ applicability }) => applicability === "applied"),
    ).toBe(true);
    expect(result.score.inputHash).toBe("sha256:complete-input");
    expect(result.score.hiddenScoredModuleCount).toBe(1);
    expect(result.score.moduleScores.zodiac).toBeDefined();
  });

  it("turns research-only sources and missing inputs into unknown evidence excluded by scoring", () => {
    const input = completeInput();
    input.folklore.baziWuxing.pack.reviewStatus = "research_only";
    input.folklore.zodiac = {
      pack: reviewedPack("zodiac-source"),
      rules: [],
    };
    input.folklore.nameHexagram.strokeRecords = input.folklore.nameHexagram.strokeRecords.map(
      (record) => ({ ...record, reviewStatus: "research_only" as const }),
    );
    input.folklore.fiveGrids.pack.reviewStatus = "research_only";

    const result = new CandidateAssessmentEngine().assess(input);
    const folkloreEvidence = new Map(
      result.evidence
        .filter(({ moduleId }) => moduleId !== "basic")
        .map((evidence) => [evidence.moduleId, evidence]),
    );

    expect(folkloreEvidence.get("bazi_wuxing")).toMatchObject({
      status: "unknown",
      applicability: "source_unverified",
    });
    expect(folkloreEvidence.get("zodiac")).toMatchObject({
      status: "unknown",
      applicability: "missing_input",
    });
    expect(folkloreEvidence.get("name_hexagram")).toMatchObject({
      status: "unknown",
      applicability: "source_unverified",
    });
    expect(folkloreEvidence.get("five_grids")).toMatchObject({
      status: "unknown",
      applicability: "source_unverified",
    });
    expect(result.score.moduleScores.bazi_wuxing).toBeUndefined();
    expect(result.score.moduleScores.zodiac).toBeUndefined();
    expect(result.score.moduleScores.name_hexagram).toBeUndefined();
    expect(result.score.moduleScores.five_grids).toBeUndefined();
  });

  it("creates all evidence before deriving CandidateScore only through the aggregator", () => {
    let aggregationInput: AggregateCandidateScoreInput | undefined;
    const sentinel: CandidateScore = {
      candidateId: "candidate-song-qing-yang",
      projectId: "project-song",
      configRevision: 7,
      inputHash: "sha256:complete-input",
      hardStatus: "pass",
      totalScore: 88,
      completeness: 1,
      evaluatedDimensions: 13,
      expectedDimensions: 13,
      hiddenScoredModuleCount: 1,
      moduleScores: { basic: 88 },
      topDeductions: [],
    };
    const aggregate = vi.fn((request: AggregateCandidateScoreInput) => {
      aggregationInput = request;
      return sentinel;
    });

    const result = new CandidateAssessmentEngine(aggregate).assess(completeInput());

    expect(result.score).toBe(sentinel);
    expect(aggregate).toHaveBeenCalledOnce();
    expect(aggregationInput?.evidence).toBe(result.evidence);
    expect(Object.keys(aggregationInput ?? {}).sort()).toEqual([
      "candidateId",
      "configRevision",
      "evidence",
      "inputHash",
      "modules",
      "projectId",
    ]);
  });
});

function completeInput(): CandidateAssessmentInput {
  const profile = namingProfileFixture("project-song");
  profile.configRevision = 7;
  profile.basics.styleTags = ["清朗自然"];
  profile.basics.pinyinFriendly = true;
  profile.usefulGodDecision = {
    confirmedElements: ["water"],
    confirmedAt: "2026-10-16T08:00:00.000Z",
  };
  for (const [moduleId, module] of Object.entries(profile.modules)) {
    module.analysisEnabled = true;
    module.detailsVisible = moduleId !== "zodiac";
    module.weight = moduleId === "bazi_wuxing" ? 20 : 5;
  }
  profile.scoring.basicWeight = 55;

  const strokeRecords = [
    reviewedStroke("宋", 7),
    reviewedStroke("清", 12),
    reviewedStroke("扬", 13),
  ];
  const fiveGridMeanings = [8, 19, 25, 14, 32].map((value) => ({
    value,
    sourceLabel: "测试复核标签",
    sourceClassification: "auspicious" as const,
    productClassification: "auspicious" as const,
    productPenalty: 0,
    reviewStatus: "reviewed" as const,
  }));

  return {
    candidate: {
      id: "candidate-song-qing-yang",
      projectId: "project-song",
      batchId: null,
      normalizedFingerprint: "宋清扬",
      surname: "宋",
      givenName: "清扬",
      fullName: "宋清扬",
      pinyin: ["qīng", "yáng"],
      sourceType: "verified_allusion",
      summary: "清澈明朗，昂扬自持。",
      createdAt: "2026-10-16T08:00:00.000Z",
    },
    profile,
    bundle,
    inputHash: "sha256:complete-input",
    facts: {
      sourceIds: ["poetry-source"],
      sourceRiskSignals: [],
      styleTags: ["清朗自然"],
      characterElements: ["water", "fire"],
      characterStrokeCounts: [11, 6],
    },
    folklore: {
      baziWuxing: {
        pack: reviewedPack("useful-god-source"),
        noMatchDeduction: 10,
      },
      zodiac: {
        pack: reviewedPack("zodiac-source"),
        zodiac: "龙",
        rules: [
          {
            id: "dragon-sky-prefer",
            zodiac: "龙",
            position: "any",
            characters: ["清", "扬"],
            direction: "prefer",
            deduction: 0,
            explanation: "明确例字提示",
            sourceId: "zodiac-source",
          },
        ],
      },
      traditional: {
        pack: reviewedPack("traditional-source"),
        principleTags: ["义"],
        tabooRules: [],
      },
      nameHexagram: {
        pack: reviewedPack("hexagram-source"),
        strokeSourceIds: ["kangxi-source"],
        strokeRecords,
      },
      fiveGrids: {
        pack: reviewedPack("five-grid-source"),
        strokeSourceIds: ["kangxi-source"],
        strokeRecords,
        meanings: fiveGridMeanings,
      },
    },
  };
}

function reviewedPack(sourceId: string) {
  return { reviewStatus: "reviewed" as const, sourceIds: [sourceId] };
}

function reviewedStroke(character: string, strokeCount: number) {
  return {
    character,
    kangxiForm: character,
    strokeCount,
    reviewStatus: "reviewed" as const,
    dictionaryIndex: `index-${character}`,
    imagePage: `page-${character}`,
    reviewedBy: "fixture-reviewer",
    reviewedAt: "2026-10-16",
  };
}
