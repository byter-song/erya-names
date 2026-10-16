import { sha256 } from "../backup/checksum";
import type {
  CandidateAssessmentInput as RecalculationCandidateInput,
  CandidateAssessmentOutput,
} from "../use-cases/RecalculateProjectAssessments";
import {
  loadRulePack,
  type FolkloreRulePackManifest,
  type LoadedRulePack,
} from "../../data/folklore/loadRulePacks";
import type { RuntimeBundle } from "../../data/schema/runtimeBundle";
import { calculateBasicFiveElements } from "../../domain/folklore/calendarAdapter";
import type { ZodiacRule } from "../../domain/folklore/zodiacAdvisory";
import type { NamingProfile } from "../../domain/project/profile";
import { scoringInputHash } from "../../domain/project/scoringInputHash";
import {
  CandidateAssessmentEngine,
  type AssessmentRulePack,
  type CandidateAssessmentFacts,
  type CandidateFolkloreInputs,
} from "../../domain/rules/CandidateAssessmentEngine";

const researchPack = (sourceIds: string[], uncertainty: string): AssessmentRulePack => ({
  reviewStatus: "research_only",
  sourceIds,
  epistemicStatus: "school_specific",
  uncertainty,
});

let reviewedCorePacks: Promise<ReviewedCorePacks> | undefined;

/** Builds the evaluator from versioned, product-reviewed folklore packs. */
export function createCandidateAssessmentEvaluator(bundle: RuntimeBundle) {
  const engine = new CandidateAssessmentEngine();

  return async ({
    candidate,
    profile,
    sources,
  }: RecalculationCandidateInput): Promise<CandidateAssessmentOutput> => {
    const profileHash = await scoringInputHash(profile);
    const inputHash = `sha256:${await sha256({
      profileHash,
      candidate: {
        id: candidate.id,
        fullName: candidate.fullName,
        pinyin: candidate.pinyin,
        sourceType: candidate.sourceType,
        summary: candidate.summary,
      },
      sources,
      datasetVersion: bundle.manifest.version,
    })}`;
    const folklore = await loadReviewedCoreFolklore(profile);
    const result = engine.assess({
      candidate,
      profile,
      bundle,
      inputHash,
      facts: buildFacts(
        candidate.givenName,
        sources.map(({ sourceId }) => sourceId),
        bundle,
      ),
      folklore,
    });
    const moduleIds = [...new Set(result.evidence.map(({ moduleId }) => moduleId))];
    return {
      replacements: moduleIds.map((moduleId) => ({
        candidateId: candidate.id,
        moduleId,
        inputHash,
        evidence: result.evidence.filter((item) => item.moduleId === moduleId),
      })),
      score: result.score,
    };
  };
}

function buildFacts(
  givenName: string,
  sourceIds: string[],
  bundle: RuntimeBundle,
): CandidateAssessmentFacts {
  const cards = [...givenName]
    .map((character) => bundle.characters.find(({ char }) => char === character))
    .filter((card) => card !== undefined);
  const allusions = bundle.allusions.filter(({ selectedText }) => selectedText === givenName);
  const strokes = cards.map(({ strokes }) => strokes);
  return {
    sourceIds: [...new Set(sourceIds)],
    sourceRiskSignals: [
      ...cards.flatMap(({ riskSignals }) => riskSignals),
      ...allusions.flatMap(({ riskSignals }) => riskSignals),
    ],
    styleTags: [
      ...new Set([
        ...cards.flatMap(({ styleTags }) => styleTags),
        ...allusions.flatMap(({ styleTags }) => styleTags),
        ...(bundle.modernCombinations?.find(({ givenName: name }) => name === givenName)
          ?.styleTags ?? []),
      ]),
    ],
    characterElements: cards.flatMap(({ element }) => (element ? [element] : [])),
    ...(strokes.length === [...givenName].length &&
    strokes.every((value) => value !== undefined)
      ? { characterStrokeCounts: strokes as number[] }
      : {}),
  };
}

async function loadReviewedCoreFolklore(
  profile: NamingProfile,
): Promise<CandidateFolkloreInputs> {
  const packs = await (reviewedCorePacks ??= loadReviewedCorePacks());
  const zodiac = resolveZodiac(profile);
  return {
    baziWuxing: {
      pack: reviewedPack(packs.bazi.manifest),
      noMatchDeduction: 10,
    },
    zodiac: {
      pack: reviewedPack(packs.zodiac.manifest),
      ...(zodiac ? { zodiac } : {}),
      rules: reviewedZodiacRules(packs.zodiac.document),
    },
    traditional: {
      pack: reviewedPack(packs.traditional.manifest),
      principleTags: [],
      tabooRules: reviewedTraditionalRules(packs.traditional.document),
    },
    nameHexagram: {
      pack: researchPack(
        ["meihua-yishu-ctext", "erya-hexagram-product-convention"],
        "姓名卦象公式与康熙笔画尚未完成生产复核，当前退出评分分母。",
      ),
      strokeSourceIds: ["unicode-unihan-17.0.0", "kangxi-image-review-queue"],
      strokeRecords: [],
    },
    fiveGrids: {
      pack: researchPack(
        ["ndl-kumasaki-1930", "unicode-unihan-17.0.0", "erya-five-grid-product-convention"],
        "五格 81 数标签与康熙笔画尚未完成生产复核，当前退出评分分母。",
      ),
      strokeSourceIds: ["unicode-unihan-17.0.0", "kangxi-image-review-queue"],
      strokeRecords: [],
      meanings: [],
    },
  };
}

interface ReviewedCorePacks {
  bazi: LoadedRulePack;
  zodiac: LoadedRulePack;
  traditional: LoadedRulePack;
}

async function loadReviewedCorePacks(): Promise<ReviewedCorePacks> {
  const [bazi, zodiac, traditional] = await Promise.all([
    loadRulePack({
      moduleId: "bazi_wuxing",
      schoolId: "four-path-useful-god-v1",
      ruleVersion: "1.0.0",
    }),
    loadRulePack({
      moduleId: "zodiac",
      schoolId: "zodiac-radical-hints-v1",
      ruleVersion: "1.0.0",
    }),
    loadRulePack({
      moduleId: "traditional",
      schoolId: "zuozhuan-naming-principles-v1",
      ruleVersion: "1.0.0",
    }),
  ]);
  return { bazi, zodiac, traditional };
}

function resolveZodiac(profile: NamingProfile): string | undefined {
  const localDateTime = profile.calendar.birthLocalDateTime;
  if (!localDateTime) return undefined;
  try {
    const calendar = calculateBasicFiveElements({
      localDateTime,
      timeZone: profile.calendar.timeZone,
      dayBoundary: profile.calendar.dayBoundary,
      timeKnown: profile.calendar.timeKnown,
    });
    return profile.calendar.zodiacConvention === "pillar"
      ? calendar.pillarZodiac
      : calendar.lunarZodiac;
  } catch {
    return undefined;
  }
}

function reviewedPack(manifest: FolkloreRulePackManifest): AssessmentRulePack {
  const checkedSourceIds = manifest.sources
    ?.filter(({ verificationStatus }) => verificationStatus !== "unverified")
    .map(({ id }) => id);
  return {
    reviewStatus: manifest.reviewStatus === "reviewed" ? "reviewed" : "research_only",
    sourceIds: checkedSourceIds?.length ? checkedSourceIds : [...manifest.sourceIds],
    ...(manifest.epistemicStatus ? { epistemicStatus: manifest.epistemicStatus } : {}),
    ...(manifest.uncertainty ? { uncertainty: manifest.uncertainty } : {}),
  };
}

function reviewedZodiacRules(input: unknown): ZodiacRule[] {
  const document = input as {
    rules: Array<ZodiacRule & { reviewStatus: "reviewed" | "research_only" }>;
  };
  return document.rules
    .filter(({ reviewStatus }) => reviewStatus === "reviewed")
    .map(
      ({ id, zodiac, position, characters, direction, deduction, explanation, sourceId }) => ({
        id,
        zodiac,
        position,
        characters: [...characters],
        direction,
        deduction,
        explanation,
        sourceId,
      }),
    );
}

function reviewedTraditionalRules(input: unknown) {
  const document = input as {
    taboos: Array<{
      id: string;
      label: string;
      terms: string[];
      sourceId: string;
      reviewStatus: "reviewed" | "research_only";
    }>;
  };
  return document.taboos
    .filter(({ reviewStatus }) => reviewStatus === "reviewed")
    .map(({ id, label, terms, sourceId }) => ({ id, label, terms: [...terms], sourceId }));
}
