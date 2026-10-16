import type { RuntimeBundle, ReviewedRiskSignal } from "../../data/schema/runtimeBundle";
import type { Candidate } from "../candidate/candidate";
import { calculateFiveGrids, evaluateFiveGridScore } from "../folklore/fiveGrids";
import type { FiveElement } from "../folklore/fiveElements";
import type { FiveGridNumberMeaning } from "../folklore/fiveGrids";
import type { KangxiStrokeRecord } from "../folklore/kangxiStrokes";
import { resolveKangxiStrokes } from "../folklore/kangxiStrokes";
import { calculateNameHexagram } from "../folklore/nameHexagram";
import {
  evaluateTraditionalNaming,
  type TraditionalPrinciple,
  type TraditionalTabooRule,
} from "../folklore/traditionalNaming";
import { evaluateZodiacHints, type ZodiacRule } from "../folklore/zodiacAdvisory";
import type { NamingProfile } from "../project/profile";
import type { CandidateScore } from "./candidateScore";
import { evaluateFamilyConstraints } from "./l1/familyConstraint";
import { evaluateStandardCharacters } from "./l1/standardCharacter";
import { evaluateFullNameSound } from "./l2/fullNameSound";
import { evaluateReviewedRisks } from "./l2/reviewedRisks";
import { ruleEvidenceSchema, type RuleEvidence, type RuleModuleId } from "./result";
import {
  aggregateCandidateScore,
  type AggregateCandidateScoreInput,
  type ScoreModuleConfiguration,
} from "./scoring/ScoreAggregator";

const ENGINE_RULE_VERSION = "candidate-assessment-1";
const BASIC_DIMENSIONS = [
  "standard_registration",
  "full_name_pronunciation",
  "meaning_combination",
  "source_quality",
  "writing_input",
  "style_expectation",
  "commonness_distinction",
  "dialect_pinyin",
] as const;

type ReviewStatus = "research_only" | "reviewed";
type EvidenceDraft = Omit<RuleEvidence, "id" | "projectId" | "candidateId" | "inputHash">;
type ScoreAggregator = (input: AggregateCandidateScoreInput) => CandidateScore;

export interface AssessmentRulePack {
  reviewStatus: ReviewStatus;
  sourceIds: string[];
  epistemicStatus?: string;
  uncertainty?: string;
}

export interface CandidateAssessmentFacts {
  sourceIds: string[];
  sourceRiskSignals: ReviewedRiskSignal[];
  styleTags: string[];
  characterElements: FiveElement[];
  /** Modern writing strokes for the writing dimension, never Kangxi numerology strokes. */
  characterStrokeCounts?: number[];
}

export interface CandidateFolkloreInputs {
  baziWuxing: {
    pack: AssessmentRulePack;
    noMatchDeduction: number;
  };
  zodiac: {
    pack: AssessmentRulePack;
    zodiac?: string;
    rules: ZodiacRule[];
  };
  traditional: {
    pack: AssessmentRulePack;
    principleTags: TraditionalPrinciple[];
    tabooRules: TraditionalTabooRule[];
  };
  nameHexagram: {
    pack: AssessmentRulePack;
    strokeSourceIds: string[];
    strokeRecords: KangxiStrokeRecord[];
  };
  fiveGrids: {
    pack: AssessmentRulePack;
    strokeSourceIds: string[];
    strokeRecords: KangxiStrokeRecord[];
    meanings: FiveGridNumberMeaning[];
  };
}

export interface CandidateAssessmentInput {
  candidate: Candidate;
  profile: NamingProfile;
  bundle: RuntimeBundle;
  inputHash: string;
  facts: CandidateAssessmentFacts;
  folklore: CandidateFolkloreInputs;
}

export interface CandidateAssessmentResult {
  evidence: RuleEvidence[];
  score: CandidateScore;
}

/**
 * Produces the auditable facts first, then delegates the disposable score cache
 * to ScoreAggregator. Display visibility is only forwarded as score metadata;
 * it never changes which rules run or the evidence they emit.
 */
export class CandidateAssessmentEngine {
  constructor(private readonly aggregateScore: ScoreAggregator = aggregateCandidateScore) {}

  assess(input: CandidateAssessmentInput): CandidateAssessmentResult {
    assertAssessmentInput(input);
    const drafts = [
      ...evaluateBasicDimensions(input),
      evaluateBaziWuxing(input),
      evaluateZodiac(input),
      evaluateTraditional(input),
      evaluateHexagram(input),
      evaluateFiveGridsModule(input),
    ];
    const evidence = drafts.map((draft, index) =>
      ruleEvidenceSchema.parse({
        ...draft,
        id: `${input.candidate.id}:${String(index + 1).padStart(2, "0")}:${draft.moduleId}:${draft.ruleId}:${input.inputHash}`,
        projectId: input.candidate.projectId,
        candidateId: input.candidate.id,
        inputHash: input.inputHash,
      }),
    );
    const score = this.aggregateScore({
      candidateId: input.candidate.id,
      projectId: input.candidate.projectId,
      configRevision: input.profile.configRevision,
      inputHash: input.inputHash,
      evidence,
      modules: scoreModules(input.profile),
    });
    return { evidence, score };
  }
}

function evaluateBasicDimensions(input: CandidateAssessmentInput): EvidenceDraft[] {
  const { candidate, profile, bundle, facts } = input;
  const standard = evaluateStandardCharacters(candidate.fullName, candidate.givenName, bundle);
  const family = evaluateFamilyConstraints({
    fullName: candidate.fullName,
    givenName: candidate.givenName,
    pinyin: candidate.pinyin,
    profile,
  });
  const reviewedRisks = evaluateReviewedRisks({
    givenName: candidate.givenName,
    sourceRiskSignals: facts.sourceRiskSignals,
    bundle,
  });
  const hardEvidence = [
    standard,
    family,
    ...reviewedRisks.filter((item) => item.outcome === "reject"),
  ].map((result): EvidenceDraft => {
    const dimensionId = riskDimension(result.ruleId);
    return {
      moduleId: "basic",
      dimensionId,
      ruleId: result.ruleId,
      ruleVersion: result.ruleVersion,
      severity: "hard",
      status:
        result.outcome === "reject"
          ? "conflict"
          : result.outcome === "warn"
            ? "notice"
            : result.outcome === "unknown"
              ? "unknown"
              : "pass",
      applicability: result.outcome === "unknown" ? "missing_input" : "applied",
      explanation: result.explanation,
      inputSummary: `完整姓名：${candidate.fullName}`,
      calculation: ["硬规则仅形成状态，不进入加权扣分公式。"],
      sourceIds: sourceIds(result.sourceRefs, internalSourceFor(result.ruleId)),
    };
  });

  const soundResults = candidate.pinyin.length
    ? evaluateFullNameSound(candidate.surname, candidate.pinyin, profile.basics.surnamePinyin)
    : [];
  const soundDeduction = sumScoreDeltas(soundResults);
  const meaningWarnings = reviewedRisks.filter(
    (item) => item.ruleId === "l2-negative-meaning" && item.outcome === "warn",
  );
  const writingWarnings = reviewedRisks.filter(
    (item) =>
      ["l2-input-risk", "l2-writing-risk", "l2-multiple-pronunciation"].includes(item.ruleId) &&
      item.outcome === "warn",
  );
  const writingDeduction = calculateWritingDeduction(
    facts.characterStrokeCounts,
    profile.basics.writingComplexity,
  );
  const styleMatches = profile.basics.styleTags.filter((tag) => facts.styleTags.includes(tag));
  const normalizedPinyin = candidate.pinyin.map(normalizeSyllable);
  const repeatedSyllable = new Set(normalizedPinyin).size !== normalizedPinyin.length;

  const softEvidence: EvidenceDraft[] = [
    appliedSoft({
      moduleId: "basic",
      dimensionId: "standard_registration",
      ruleId: "basic-standard-registration",
      deduction: 0,
      explanation: "规范字与登记风险由独立硬规则记录；本维度不重复扣分。",
      inputSummary: `姓名 ${candidate.fullName}，家庭约束 ${profile.family.constraintKnowledge}`,
      calculation: ["基础分 100；硬规则状态另行聚合；本软维度扣 0。"],
      sourceIds: sourceIds(standard.sourceRefs, "erya-family-constraints"),
    }),
    candidate.pinyin.length
      ? appliedSoft({
          moduleId: "basic",
          dimensionId: "full_name_pronunciation",
          ruleId: "basic-full-name-pronunciation",
          deduction: soundDeduction,
          explanation: soundResults.length
            ? soundResults.map(({ explanation }) => explanation).join("；")
            : "当前有限普通话全名谐音表未命中明确风险。",
          inputSummary: `名字拼音：${candidate.pinyin.join(" ")}`,
          calculation: ["汇总已复核全名读音风险的负向扣分，单维最低为 0。"],
          sourceIds: sourceIds(
            soundResults.flatMap(({ sourceRefs }) => sourceRefs),
            "erya-full-name-sound-rules",
          ),
        })
      : unknownSoft({
          moduleId: "basic",
          dimensionId: "full_name_pronunciation",
          ruleId: "basic-full-name-pronunciation",
          applicability: "missing_input",
          explanation: "缺少名字逐字拼音，无法核对全名读音。",
          inputSummary: `姓名：${candidate.fullName}`,
          calculation: ["缺少拼音时不把本维度按 0 分处理。"],
          sourceIds: ["erya-full-name-sound-rules"],
        }),
    candidate.summary.trim()
      ? appliedSoft({
          moduleId: "basic",
          dimensionId: "meaning_combination",
          ruleId: "basic-meaning-combination",
          deduction: Math.min(24, meaningWarnings.length * 8),
          explanation: meaningWarnings.length
            ? meaningWarnings.map(({ explanation }) => explanation).join("；")
            : "候选有明确释义，当前已复核风险库未发现负面字义提醒。",
          inputSummary: candidate.summary,
          calculation: ["每条已复核负面字义软提醒扣 8 分，本维最多扣 24 分。"],
          sourceIds: sourceIds(
            [...facts.sourceIds, ...meaningWarnings.flatMap(({ sourceRefs }) => sourceRefs)],
            "erya-reviewed-language-risks",
          ),
        })
      : unknownSoft({
          moduleId: "basic",
          dimensionId: "meaning_combination",
          ruleId: "basic-meaning-combination",
          applicability: "missing_input",
          explanation: "缺少候选释义，无法评价字义组合。",
          inputSummary: `名字：${candidate.givenName}`,
          calculation: ["缺少释义时退出该维度分数。"],
          sourceIds: sourceIds(facts.sourceIds, "erya-reviewed-language-risks"),
        }),
    facts.sourceIds.length
      ? appliedSoft({
          moduleId: "basic",
          dimensionId: "source_quality",
          ruleId: "basic-source-quality",
          deduction: sourceQualityDeduction(candidate.sourceType),
          explanation: sourceQualityExplanation(candidate.sourceType),
          inputSummary: `来源类型：${candidate.sourceType}`,
          calculation: ["典故原句扣 0；现代组合扣 2；历史人物借字扣 4；手工录入扣 8。"],
          sourceIds: facts.sourceIds,
        })
      : unknownSoft({
          moduleId: "basic",
          dimensionId: "source_quality",
          ruleId: "basic-source-quality",
          applicability: "missing_input",
          explanation: "候选缺少可追溯来源记录。",
          inputSummary: `来源类型：${candidate.sourceType}`,
          calculation: ["缺少来源时退出该维度分数并提示补充。"],
          sourceIds: ["erya-source-provenance-policy"],
        }),
    facts.characterStrokeCounts?.length === [...candidate.givenName].length
      ? appliedSoft({
          moduleId: "basic",
          dimensionId: "writing_input",
          ruleId: "basic-writing-input",
          deduction: Math.min(20, writingDeduction + writingWarnings.length * 4),
          explanation: writingWarnings.length
            ? writingWarnings.map(({ explanation }) => explanation).join("；")
            : "已按现代书写笔画和方案偏好检查书写输入。",
          inputSummary: `现代书写笔画：${facts.characterStrokeCounts.join("+")}`,
          calculation: [
            `书写复杂度偏好 ${profile.basics.writingComplexity}；再合并每条输入或书写软提醒 4 分。`,
          ],
          sourceIds: sourceIds(
            writingWarnings.flatMap(({ sourceRefs }) => sourceRefs),
            "unihan-17",
          ),
        })
      : unknownSoft({
          moduleId: "basic",
          dimensionId: "writing_input",
          ruleId: "basic-writing-input",
          applicability: "missing_input",
          explanation: "缺少完整的现代书写笔画，无法评价书写复杂度。",
          inputSummary: `名字：${candidate.givenName}`,
          calculation: ["现代书写数据不完整时退出该维度分数。"],
          sourceIds: ["unihan-17"],
        }),
    profile.basics.styleTags.length
      ? appliedSoft({
          moduleId: "basic",
          dimensionId: "style_expectation",
          ruleId: "basic-style-expectation",
          deduction: styleMatches.length ? 0 : 4,
          explanation: styleMatches.length
            ? `匹配风格偏好：${styleMatches.join("、")}`
            : `未匹配已选择风格：${profile.basics.styleTags.join("、")}`,
          inputSummary: `候选标签：${facts.styleTags.join("、") || "无"}`,
          calculation: ["至少命中一个所选标签扣 0，否则扣 4。"],
          sourceIds: ["erya-editorial-style-tags"],
        })
      : unknownSoft({
          moduleId: "basic",
          dimensionId: "style_expectation",
          ruleId: "basic-style-expectation",
          applicability: "not_applicable",
          explanation: "方案没有设置风格偏好，本维度不适用。",
          inputSummary: "风格偏好：未设置",
          calculation: ["未配置偏好时退出该维度分母。"],
          sourceIds: ["erya-editorial-style-tags"],
        }),
    unknownSoft({
      moduleId: "basic",
      dimensionId: "commonness_distinction",
      ruleId: "basic-commonness-distinction",
      applicability: "source_unverified",
      explanation: "当前没有可校准的新生儿姓名频率资料，不推测常见度。",
      inputSummary: `姓名：${candidate.fullName}`,
      calculation: ["频率资料未复核时退出该维度分数。"],
      sourceIds: ["erya-commonness-data-gap"],
    }),
    profile.basics.pinyinFriendly
      ? candidate.pinyin.length
        ? appliedSoft({
            moduleId: "basic",
            dimensionId: "dialect_pinyin",
            ruleId: "basic-dialect-pinyin",
            deduction: repeatedSyllable ? 4 : 0,
            explanation: repeatedSyllable
              ? "普通话拼音存在重复音节，日常呼叫辨识度可能下降。"
              : "普通话拼音音节没有重复；方言仍需家人自行试读。",
            inputSummary: `普通话拼音：${candidate.pinyin.join(" ")}；方言备注：${profile.basics.dialectNotes || "未填写"}`,
            calculation: ["启用拼音友好时，重复音节扣 4；不从方言备注自动推断结论。"],
            sourceIds: ["pinyin-data"],
          })
        : unknownSoft({
            moduleId: "basic",
            dimensionId: "dialect_pinyin",
            ruleId: "basic-dialect-pinyin",
            applicability: "missing_input",
            explanation: "已启用拼音友好，但候选缺少逐字拼音。",
            inputSummary: `姓名：${candidate.fullName}`,
            calculation: ["缺少拼音时退出该维度分数。"],
            sourceIds: ["pinyin-data"],
          })
      : unknownSoft({
          moduleId: "basic",
          dimensionId: "dialect_pinyin",
          ruleId: "basic-dialect-pinyin",
          applicability: "not_applicable",
          explanation: "方案没有启用拼音友好偏好，本维度不适用。",
          inputSummary: `方言备注：${profile.basics.dialectNotes || "未填写"}`,
          calculation: ["未启用拼音友好时退出该维度分母。"],
          sourceIds: ["pinyin-data"],
        }),
  ];

  return [...hardEvidence, ...softEvidence];
}

function evaluateBaziWuxing(input: CandidateAssessmentInput): EvidenceDraft {
  const dimensionId = "useful_god_match";
  const module = input.profile.modules.bazi_wuxing;
  const { pack, noMatchDeduction } = input.folklore.baziWuxing;
  const unavailable = unavailableModuleEvidence({
    moduleId: "bazi_wuxing",
    dimensionId,
    ruleId: "bazi-useful-god-match",
    moduleEnabled: module.analysisEnabled,
    pack,
    inputSummary: `候选字义五行：${input.facts.characterElements.join("、") || "缺失"}`,
  });
  if (unavailable) return unavailable;
  const confirmed = input.profile.usefulGodDecision?.confirmedElements ?? [];
  if (!confirmed.length || !input.facts.characterElements.length)
    return unknownSoft({
      moduleId: "bazi_wuxing",
      dimensionId,
      ruleId: "bazi-useful-god-match",
      ruleVersion: module.ruleVersion,
      schoolId: module.schoolId,
      applicability: "missing_input",
      explanation: "缺少用户确认的采用五行或名字逐字五行，不能参与评分。",
      inputSummary: `确认采用：${confirmed.join("、") || "未确认"}；名字五行：${input.facts.characterElements.join("、") || "缺失"}`,
      calculation: ["未确认用神或缺少字义五行时退出本模块分母。"],
      sourceIds: pack.sourceIds,
      uncertainty: pack.uncertainty,
    });
  const matches = input.facts.characterElements.filter((element) =>
    confirmed.includes(element),
  );
  const deduction = matches.length ? 0 : noMatchDeduction;
  return appliedSoft({
    moduleId: "bazi_wuxing",
    dimensionId,
    ruleId: "bazi-useful-god-match",
    ruleVersion: module.ruleVersion,
    schoolId: module.schoolId,
    deduction,
    explanation: matches.length
      ? `名字字义五行命中用户确认采用的五行：${[...new Set(matches)].join("、")}。`
      : "名字字义五行未命中用户确认采用的五行。",
    inputSummary: `确认采用：${confirmed.join("、")}；名字五行：${input.facts.characterElements.join("、")}`,
    calculation: [`至少命中一个确认元素扣 0，否则扣 ${noMatchDeduction}。`],
    sourceIds: pack.sourceIds,
    uncertainty: pack.uncertainty,
  });
}

function evaluateZodiac(input: CandidateAssessmentInput): EvidenceDraft {
  const dimensionId = "radical_advisory";
  const module = input.profile.modules.zodiac;
  const value = input.folklore.zodiac;
  const unavailable = unavailableModuleEvidence({
    moduleId: "zodiac",
    dimensionId,
    ruleId: "zodiac-radical-advisory",
    moduleEnabled: module.analysisEnabled,
    pack: value.pack,
    inputSummary: `生肖：${value.zodiac || "未确定"}；名字：${input.candidate.givenName}`,
  });
  if (unavailable) return unavailable;
  if (!value.zodiac)
    return unknownSoft({
      moduleId: "zodiac",
      dimensionId,
      ruleId: "zodiac-radical-advisory",
      ruleVersion: module.ruleVersion,
      schoolId: module.schoolId,
      applicability: "missing_input",
      explanation: "出生输入尚不能确定所选口径下的生肖。",
      inputSummary: `生肖口径：${input.profile.calendar.zodiacConvention}`,
      calculation: ["生肖未知时不匹配字根提示，并退出模块分母。"],
      sourceIds: value.pack.sourceIds,
      uncertainty: value.pack.uncertainty,
    });
  const result = evaluateZodiacHints({
    givenName: input.candidate.givenName,
    zodiac: value.zodiac,
    rules: value.rules,
  });
  return appliedSoft({
    moduleId: "zodiac",
    dimensionId,
    ruleId: "zodiac-radical-advisory",
    ruleVersion: module.ruleVersion,
    schoolId: module.schoolId,
    deduction: result.deduction,
    status: result.hardStatus,
    explanation: result.hits.length
      ? `命中当前流派提示：${result.hits.map(({ id }) => id).join("、")}。只作民俗提示，不过滤候选。`
      : "未命中当前规则包提醒；不代表符合所有生肖姓名流派。",
    inputSummary: `生肖：${value.zodiac}；名字：${input.candidate.givenName}`,
    calculation: ["负向命中按规则扣分，模块最多扣 20；正向命中只展示不加分。"],
    sourceIds: sourceIds(
      result.hits.map(({ sourceId }) => sourceId),
      ...value.pack.sourceIds,
    ),
    uncertainty: value.pack.uncertainty,
  });
}

function evaluateTraditional(input: CandidateAssessmentInput): EvidenceDraft {
  const dimensionId = "principles_taboos";
  const module = input.profile.modules.traditional;
  const value = input.folklore.traditional;
  const unavailable = unavailableModuleEvidence({
    moduleId: "traditional",
    dimensionId,
    ruleId: "traditional-principles-taboos",
    moduleEnabled: module.analysisEnabled,
    pack: value.pack,
    inputSummary: `姓名：${input.candidate.fullName}`,
  });
  if (unavailable) return unavailable;
  const result = evaluateTraditionalNaming({
    fullName: input.candidate.givenName,
    principleTags: value.principleTags,
    tabooRules: value.tabooRules,
  });
  return appliedSoft({
    moduleId: "traditional",
    dimensionId,
    ruleId: "traditional-principles-taboos",
    ruleVersion: module.ruleVersion,
    schoolId: module.schoolId,
    deduction: result.deduction,
    status: result.hardStatus,
    explanation: `取意标签：${result.principleTags.join("、") || "未标注"}；${result.hits.length ? `字面命中：${result.hits.map(({ label }) => label).join("、")}` : "未命中当前六禁忌字面规则"}。`,
    inputSummary: `名（不含姓氏）：${input.candidate.givenName}`,
    calculation: ["五原则只生成标签；六禁忌字面命中每项扣 5，模块最多扣 15。"],
    sourceIds: sourceIds(
      result.hits.map(({ sourceId }) => sourceId),
      ...value.pack.sourceIds,
    ),
    uncertainty: value.pack.uncertainty,
  });
}

function evaluateHexagram(input: CandidateAssessmentInput): EvidenceDraft {
  const dimensionId = "body_use_relation";
  const module = input.profile.modules.name_hexagram;
  const value = input.folklore.nameHexagram;
  const unavailable = unavailableModuleEvidence({
    moduleId: "name_hexagram",
    dimensionId,
    ruleId: "name-hexagram-body-use",
    moduleEnabled: module.analysisEnabled,
    pack: value.pack,
    inputSummary: `姓名：${input.candidate.fullName}`,
  });
  if (unavailable) return unavailable;
  const strokes = resolveNameStrokes(input.candidate, value.strokeRecords);
  if (!strokes.ok)
    return unresolvedStrokeEvidence({
      moduleId: "name_hexagram",
      dimensionId,
      ruleId: "name-hexagram-body-use",
      module,
      pack: value.pack,
      strokeSourceIds: value.strokeSourceIds,
      candidate: input.candidate,
      records: value.strokeRecords,
      missingCharacters: strokes.missingCharacters,
    });
  const result = calculateNameHexagram({
    surnameStrokes: strokes.surname,
    givenNameStrokes: strokes.givenName,
  });
  return appliedSoft({
    moduleId: "name_hexagram",
    dimensionId,
    ruleId: "name-hexagram-body-use",
    ruleVersion: module.ruleVersion,
    schoolId: module.schoolId,
    deduction: result.deduction,
    explanation: `本卦上卦${result.original.upper.name}、下卦${result.original.lower.name}，动第 ${result.movingLine} 爻；只作传统民俗参考。`,
    inputSummary: `姓氏笔画 ${strokes.surname.join("+")}；名字笔画 ${strokes.givenName.join("+")}`,
    calculation: result.calculation,
    sourceIds: sourceIds(value.strokeSourceIds, ...value.pack.sourceIds),
    uncertainty: value.pack.uncertainty,
  });
}

function evaluateFiveGridsModule(input: CandidateAssessmentInput): EvidenceDraft {
  const dimensionId = "grids_three_talent";
  const module = input.profile.modules.five_grids;
  const value = input.folklore.fiveGrids;
  const unavailable = unavailableModuleEvidence({
    moduleId: "five_grids",
    dimensionId,
    ruleId: "five-grids-three-talent",
    moduleEnabled: module.analysisEnabled,
    pack: value.pack,
    inputSummary: `姓名：${input.candidate.fullName}`,
  });
  if (unavailable) return unavailable;
  const strokes = resolveNameStrokes(input.candidate, value.strokeRecords);
  if (!strokes.ok)
    return unresolvedStrokeEvidence({
      moduleId: "five_grids",
      dimensionId,
      ruleId: "five-grids-three-talent",
      module,
      pack: value.pack,
      strokeSourceIds: value.strokeSourceIds,
      candidate: input.candidate,
      records: value.strokeRecords,
      missingCharacters: strokes.missingCharacters,
    });
  const grids = calculateFiveGrids(strokes.surname, strokes.givenName);
  const result = evaluateFiveGridScore(grids, value.meanings);
  if (result.applicability === "source_unverified")
    return unknownSoft({
      moduleId: "five_grids",
      dimensionId,
      ruleId: "five-grids-three-talent",
      ruleVersion: module.ruleVersion,
      schoolId: module.schoolId,
      applicability: "source_unverified",
      explanation: `81 数标签或产品扣分尚未完成复核：${result.missingValues.join("、") || "未知"}。`,
      inputSummary: `五格：${grids.map(({ label, value: gridValue }) => `${label}${gridValue}`).join("、")}`,
      calculation: grids.map(({ label, formula }) => `${label}：${formula}`),
      sourceIds: sourceIds(value.strokeSourceIds, ...value.pack.sourceIds),
      uncertainty: value.pack.uncertainty,
    });
  return appliedSoft({
    moduleId: "five_grids",
    dimensionId,
    ruleId: "five-grids-three-talent",
    ruleVersion: module.ruleVersion,
    schoolId: module.schoolId,
    deduction: result.deduction,
    explanation: `五格与三才按版本化产品扣分表演算；不把产品映射描述成原著分值。`,
    inputSummary: `五格：${grids.map(({ label, value: gridValue }) => `${label}${gridValue}`).join("、")}`,
    calculation: [
      ...grids.map(({ label, formula }) => `${label}：${formula}`),
      ...result.threeTalent.relations.map(
        ({ id, deduction }, index) => `三才关系 ${index + 1}：${id}，扣 ${deduction}`,
      ),
    ],
    sourceIds: sourceIds(value.strokeSourceIds, ...value.pack.sourceIds),
    uncertainty: value.pack.uncertainty,
  });
}

function unavailableModuleEvidence(input: {
  moduleId: Exclude<RuleModuleId, "basic">;
  dimensionId: string;
  ruleId: string;
  moduleEnabled: boolean;
  pack: AssessmentRulePack;
  inputSummary: string;
}): EvidenceDraft | undefined {
  if (!input.moduleEnabled)
    return unknownSoft({
      moduleId: input.moduleId,
      dimensionId: input.dimensionId,
      ruleId: input.ruleId,
      applicability: "not_applicable",
      explanation: "本模块未启用分析。",
      inputSummary: input.inputSummary,
      calculation: ["未启用模块不参与综合分和完整度分母。"],
      sourceIds: sourceIds(input.pack.sourceIds, "erya-folklore-module-config"),
      uncertainty: input.pack.uncertainty,
    });
  if (input.pack.reviewStatus !== "reviewed" || input.pack.sourceIds.length === 0)
    return unknownSoft({
      moduleId: input.moduleId,
      dimensionId: input.dimensionId,
      ruleId: input.ruleId,
      applicability: "source_unverified",
      explanation: "当前规则包尚未完成资料复核，只保留研究性结果，不进入评分。",
      inputSummary: input.inputSummary,
      calculation: ["research_only 或缺少来源的规则包退出评分分母。"],
      sourceIds: sourceIds(input.pack.sourceIds),
      uncertainty: input.pack.uncertainty,
    });
  return undefined;
}

function unresolvedStrokeEvidence(input: {
  moduleId: "name_hexagram" | "five_grids";
  dimensionId: string;
  ruleId: string;
  module: NamingProfile["modules"]["name_hexagram"];
  pack: AssessmentRulePack;
  strokeSourceIds: string[];
  candidate: Candidate;
  records: KangxiStrokeRecord[];
  missingCharacters: string[];
}): EvidenceDraft {
  const hasResearchOnlyRecord = input.records.some(
    ({ character, reviewStatus }) =>
      input.candidate.fullName.includes(character) && reviewStatus === "research_only",
  );
  return unknownSoft({
    moduleId: input.moduleId,
    dimensionId: input.dimensionId,
    ruleId: input.ruleId,
    ruleVersion: input.module.ruleVersion,
    schoolId: input.module.schoolId,
    applicability: hasResearchOnlyRecord ? "source_unverified" : "missing_input",
    explanation: `姓名含未取得唯一复核康熙笔画的字：${input.missingCharacters.join("、")}。`,
    inputSummary: `姓名：${input.candidate.fullName}`,
    calculation: ["任一字缺少唯一 reviewed 康熙笔画时，整个模块为 unknown。"],
    sourceIds: sourceIds(input.strokeSourceIds, ...input.pack.sourceIds),
    uncertainty: input.pack.uncertainty,
  });
}

function resolveNameStrokes(candidate: Candidate, records: KangxiStrokeRecord[]) {
  const surname = resolveKangxiStrokes(candidate.surname, records);
  const givenName = resolveKangxiStrokes(candidate.givenName, records);
  if (surname.status === "reviewed" && givenName.status === "reviewed")
    return {
      ok: true as const,
      surname: surname.strokeCounts,
      givenName: givenName.strokeCounts,
      missingCharacters: [],
    };
  return {
    ok: false as const,
    missingCharacters: [
      ...new Set([...surname.missingCharacters, ...givenName.missingCharacters]),
    ],
  };
}

function scoreModules(
  profile: NamingProfile,
): Readonly<Record<RuleModuleId, ScoreModuleConfiguration>> {
  return {
    basic: {
      analysisEnabled: true,
      detailsVisible: true,
      weight: profile.scoring.basicWeight,
      dimensionWeights: Object.fromEntries(BASIC_DIMENSIONS.map((id) => [id, 1])),
    },
    bazi_wuxing: folkloreScoreModule(profile, "bazi_wuxing", "useful_god_match"),
    zodiac: folkloreScoreModule(profile, "zodiac", "radical_advisory"),
    traditional: folkloreScoreModule(profile, "traditional", "principles_taboos"),
    name_hexagram: folkloreScoreModule(profile, "name_hexagram", "body_use_relation"),
    five_grids: folkloreScoreModule(profile, "five_grids", "grids_three_talent"),
  };
}

function folkloreScoreModule(
  profile: NamingProfile,
  moduleId: keyof NamingProfile["modules"],
  dimensionId: string,
): ScoreModuleConfiguration {
  const module = profile.modules[moduleId];
  return {
    analysisEnabled: module.analysisEnabled,
    detailsVisible: module.detailsVisible,
    weight: module.weight,
    dimensionWeights: { [dimensionId]: 1 },
  };
}

function appliedSoft(
  input: Omit<
    EvidenceDraft,
    | "severity"
    | "status"
    | "applicability"
    | "scoreBefore"
    | "scoreAfter"
    | "deduction"
    | "ruleVersion"
    | "schoolId"
  > & {
    deduction: number;
    status?: "pass" | "notice" | "conflict";
    ruleVersion?: string;
    schoolId?: string;
  },
): EvidenceDraft {
  const deduction = Math.min(100, Math.max(0, input.deduction));
  return {
    ...input,
    ruleVersion: input.ruleVersion ?? ENGINE_RULE_VERSION,
    severity: "soft",
    status: input.status ?? (deduction > 0 ? "notice" : "pass"),
    applicability: "applied",
    scoreBefore: 100,
    deduction,
    scoreAfter: 100 - deduction,
    sourceIds: sourceIds(input.sourceIds),
  };
}

function unknownSoft(
  input: Omit<
    EvidenceDraft,
    | "severity"
    | "status"
    | "scoreBefore"
    | "scoreAfter"
    | "deduction"
    | "ruleVersion"
    | "schoolId"
  > & {
    applicability: "not_applicable" | "missing_input" | "source_unverified";
    ruleVersion?: string;
    schoolId?: string;
  },
): EvidenceDraft {
  return {
    ...input,
    ruleVersion: input.ruleVersion ?? ENGINE_RULE_VERSION,
    severity: "soft",
    status: "unknown",
    sourceIds: sourceIds(input.sourceIds),
  };
}

function sourceIds(values: readonly string[], ...additional: string[]): string[] {
  const normalized = [...values, ...additional].map((value) => value.trim()).filter(Boolean);
  return normalized.length ? [...new Set(normalized)] : ["source-reference-missing"];
}

function internalSourceFor(ruleId: string): string {
  if (ruleId.includes("family")) return "erya-family-constraints";
  if (ruleId.includes("standard")) return "standard-hanzi-2013";
  return "erya-reviewed-language-risks";
}

function riskDimension(ruleId: string): (typeof BASIC_DIMENSIONS)[number] {
  if (ruleId.includes("homophone") || ruleId.includes("pronunciation"))
    return "full_name_pronunciation";
  if (ruleId.includes("writing") || ruleId.includes("input")) return "writing_input";
  if (ruleId.includes("negative-meaning")) return "meaning_combination";
  return "standard_registration";
}

function sumScoreDeltas(results: ReadonlyArray<{ scoreDelta?: number }>): number {
  return Math.min(
    100,
    results.reduce((total, { scoreDelta }) => total + Math.max(0, -(scoreDelta ?? 0)), 0),
  );
}

function calculateWritingDeduction(
  strokes: number[] | undefined,
  preference: NamingProfile["basics"]["writingComplexity"],
): number {
  if (!strokes?.length || preference === "unrestricted") return 0;
  if (preference === "simple") return Math.min(8, Math.max(0, Math.max(...strokes) - 10));
  return Math.min(6, Math.max(0, Math.max(...strokes) - Math.min(...strokes) - 4));
}

function sourceQualityDeduction(sourceType: Candidate["sourceType"]): number {
  return {
    verified_allusion: 0,
    modern_combination: 2,
    historical_inspiration: 4,
    user_input: 8,
  }[sourceType];
}

function sourceQualityExplanation(sourceType: Candidate["sourceType"]): string {
  return {
    verified_allusion: "来源为已核对的古籍原句。",
    modern_combination: "来源为编辑整理的现代组合，不宣称古籍出处。",
    historical_inspiration: "来源为历史人物用名借字灵感，人物身份不构成加分。",
    user_input: "来源为用户手工录入，建议自行补充出处和语境核对。",
  }[sourceType];
}

function normalizeSyllable(value: string): string {
  return value
    .toLowerCase()
    .replace(/[üǖǘǚǜ]/gu, "v")
    .normalize("NFD")
    .replace(/[\u0300-\u036f1-5]/gu, "");
}

function assertAssessmentInput(input: CandidateAssessmentInput): void {
  if (input.candidate.projectId !== input.profile.projectId)
    throw new Error(
      "CandidateAssessmentEngine received candidate and profile from different projects",
    );
  if (!input.inputHash.trim())
    throw new Error("CandidateAssessmentEngine inputHash is required");
  if (
    !Number.isFinite(input.folklore.baziWuxing.noMatchDeduction) ||
    input.folklore.baziWuxing.noMatchDeduction < 0
  )
    throw new Error("CandidateAssessmentEngine bazi no-match deduction must be non-negative");
}
