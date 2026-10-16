import usefulGodRules from "../../../data/sources/personal/folklore/useful-god/rules.json";
import type { FiveElement } from "./fiveElements";

export type UsefulGodPathId = "fuyi-v1" | "yueling-v1" | "tiaohou-v1" | "tongguan-v1";
export type UsefulGodApplicability =
  "applied" | "not_applicable" | "missing_input" | "source_unverified";

export interface UsefulGodInput {
  pillars: readonly string[];
  dayMasterElement: FiveElement;
  distribution: Record<FiveElement, number>;
  monthBranch: string;
  /** Only an explicit user decision may make name-element scoring applicable. */
  confirmedElements?: readonly FiveElement[];
}

export interface UsefulGodPathResult {
  pathId: UsefulGodPathId;
  label: string;
  evidence: string[];
  counterEvidence: string[];
  recommendedElements: FiveElement[];
  opposedElements: FiveElement[];
  confidence: "insufficient" | "low";
  applicability: UsefulGodApplicability;
  /** Formula and input boundary have passed product review. */
  reviewStatus: "reviewed";
  /** The cultural interpretation remains a non-unique, low-confidence model. */
  epistemicStatus: "research_model";
  sourceIds: string[];
}

export interface UsefulGodConsensus {
  status: "agreement" | "partial_agreement" | "conflict" | "insufficient_input";
  candidateElements: FiveElement[];
  explanation: string;
}

const elements: readonly FiveElement[] = ["wood", "fire", "earth", "metal", "water"];

const generatedBy: Record<FiveElement, FiveElement> = {
  wood: "water",
  fire: "wood",
  earth: "fire",
  metal: "earth",
  water: "metal",
};

const produces: Record<FiveElement, FiveElement> = {
  wood: "fire",
  fire: "earth",
  earth: "metal",
  metal: "water",
  water: "wood",
};

const controls: Record<FiveElement, FiveElement> = {
  wood: "earth",
  fire: "metal",
  earth: "water",
  metal: "wood",
  water: "fire",
};

const branchElement: Record<string, FiveElement> = {
  寅: "wood",
  卯: "wood",
  巳: "fire",
  午: "fire",
  辰: "earth",
  戌: "earth",
  丑: "earth",
  未: "earth",
  申: "metal",
  酉: "metal",
  亥: "water",
  子: "water",
};

const regulatingElement: Record<string, FiveElement> = {
  寅: "fire",
  卯: "fire",
  辰: "water",
  巳: "water",
  午: "water",
  未: "water",
  申: "water",
  酉: "water",
  戌: "water",
  亥: "fire",
  子: "fire",
  丑: "fire",
};

function unique(values: readonly FiveElement[]): FiveElement[] {
  return [...new Set(values)];
}

function pathApplicability(hasHourPillar: boolean): UsefulGodApplicability {
  return hasHourPillar ? "applied" : "missing_input";
}

function counterEvidence(hasHourPillar: boolean, detail: string): string[] {
  return [
    detail,
    hasHourPillar
      ? "合冲刑害、透干与藏干权重尚未完成逐条底本复核。"
      : "时辰不详，缺少时柱信息。",
  ];
}

function fuyiPath(
  input: UsefulGodInput,
  hasHourPillar: boolean,
): Omit<UsefulGodPathResult, "label" | "reviewStatus" | "epistemicStatus" | "sourceIds"> {
  const self = input.distribution[input.dayMasterElement];
  const resourceElement = generatedBy[input.dayMasterElement];
  const support = self + input.distribution[resourceElement];
  const total = elements.reduce((sum, element) => sum + input.distribution[element], 0);
  const isRelativelyWeak = support * 2 < total;
  const recommended = isRelativelyWeak
    ? [resourceElement, input.dayMasterElement]
    : [produces[input.dayMasterElement], controls[input.dayMasterElement]];

  return {
    pathId: "fuyi-v1",
    evidence: [
      `本气等权计数：同类 ${self}，生助 ${resourceElement} ${input.distribution[resourceElement]}，合计 ${support}/${total}。`,
      `研究性简化判断为${isRelativelyWeak ? "生助少于其余" : "生助不少于其余"}。`,
    ],
    counterEvidence: counterEvidence(
      hasHourPillar,
      "本气等权计数不包含藏干权重、月令旺衰、合化和从格条件。",
    ),
    recommendedElements: unique(recommended),
    opposedElements: [],
    confidence: hasHourPillar ? "low" : "insufficient",
    applicability: pathApplicability(hasHourPillar),
  };
}

function yuelingPath(
  input: UsefulGodInput,
  hasHourPillar: boolean,
): Omit<UsefulGodPathResult, "label" | "reviewStatus" | "epistemicStatus" | "sourceIds"> {
  const monthElement = branchElement[input.monthBranch];
  return {
    pathId: "yueling-v1",
    evidence: [
      monthElement
        ? `月支 ${input.monthBranch} 的主气分类为 ${monthElement}。`
        : `月支 ${input.monthBranch || "未提供"} 暂无可识别主气。`,
      "本路径只保留月令观察，不判定格局成立。",
    ],
    counterEvidence: counterEvidence(hasHourPillar, "格局成立与破格条件尚未完成逐条底本复核。"),
    recommendedElements: monthElement ? [produces[monthElement]] : [],
    opposedElements: [],
    confidence: hasHourPillar && monthElement ? "low" : "insufficient",
    applicability: monthElement ? pathApplicability(hasHourPillar) : "missing_input",
  };
}

function tiaohouPath(
  input: UsefulGodInput,
  hasHourPillar: boolean,
): Omit<UsefulGodPathResult, "label" | "reviewStatus" | "epistemicStatus" | "sourceIds"> {
  const candidate = regulatingElement[input.monthBranch];
  return {
    pathId: "tiaohou-v1",
    evidence: [
      candidate
        ? `按月支 ${input.monthBranch} 的季节温湿简表，${candidate}列为待核对候选。`
        : `月支 ${input.monthBranch || "未提供"} 没有调候候选。`,
      "候选只用于展示路径差异，不自动成为采用元素。",
    ],
    counterEvidence: counterEvidence(
      hasHourPillar,
      "原局已有调候条件及其强弱尚未完成逐条底本复核。",
    ),
    recommendedElements: candidate ? [candidate] : [],
    opposedElements: [],
    confidence: hasHourPillar && candidate ? "low" : "insufficient",
    applicability: candidate ? pathApplicability(hasHourPillar) : "missing_input",
  };
}

function tongguanPath(
  input: UsefulGodInput,
  hasHourPillar: boolean,
): Omit<UsefulGodPathResult, "label" | "reviewStatus" | "epistemicStatus" | "sourceIds"> {
  const rankedConflicts = elements
    .map((controller, index) => {
      const controlled = controls[controller];
      return {
        controller,
        controlled,
        index,
        strength: Math.min(input.distribution[controller], input.distribution[controlled]),
      };
    })
    .filter((item) => item.strength > 0)
    .sort((left, right) => right.strength - left.strength || left.index - right.index);
  const strongest = rankedConflicts[0];
  const bridge = strongest ? produces[strongest.controller] : undefined;

  return {
    pathId: "tongguan-v1",
    evidence: [
      strongest
        ? `等权分布中 ${strongest.controller} 与 ${strongest.controlled} 同时出现，最小计数为 ${strongest.strength}。`
        : "等权分布未观察到可计算的相克元素对。",
      bridge ? `${bridge}仅列为结构桥接的研究候选。` : "本路径未触发桥接候选。",
    ],
    counterEvidence: counterEvidence(
      hasHourPillar,
      strongest
        ? "同时出现不等于构成需要通关的强冲突，实际强弱尚待复核。"
        : "没有观察到元素对，通关路径可能不适用。",
    ),
    recommendedElements: bridge ? [bridge] : [],
    opposedElements: [],
    confidence: hasHourPillar && bridge ? "low" : "insufficient",
    applicability: bridge ? pathApplicability(hasHourPillar) : "not_applicable",
  };
}

function aggregateConsensus(
  paths: readonly UsefulGodPathResult[],
  hasHourPillar: boolean,
): UsefulGodConsensus {
  if (!hasHourPillar)
    return {
      status: "insufficient_input",
      candidateElements: [],
      explanation: "时辰不详，四条路径保留观察但不聚合结论。",
    };

  const primaries = paths.flatMap((path) => path.recommendedElements.slice(0, 1));
  if (primaries.length !== paths.length)
    return {
      status: "insufficient_input",
      candidateElements: unique(primaries),
      explanation: "至少一条路径没有产生候选，资料不足。",
    };

  const counts = new Map<FiveElement, number>();
  for (const element of primaries) counts.set(element, (counts.get(element) ?? 0) + 1);
  const ranked = [...counts.entries()].sort(
    ([leftElement, leftCount], [rightElement, rightCount]) =>
      rightCount - leftCount || elements.indexOf(leftElement) - elements.indexOf(rightElement),
  );
  const highest = ranked[0]?.[1] ?? 0;
  const candidateElements = ranked
    .filter(([, count]) => count === highest)
    .map(([element]) => element);

  if (counts.size === 1)
    return {
      status: "agreement",
      candidateElements,
      explanation: "四条研究路径的首选候选一致；仍需用户确认且不构成确定结论。",
    };
  if (highest > paths.length / 2)
    return {
      status: "partial_agreement",
      candidateElements,
      explanation: "多数研究路径的首选候选一致，其他路径存在不同意见。",
    };
  return {
    status: "conflict",
    candidateElements,
    explanation: "研究路径之间没有形成多数一致意见，保留冲突供用户判断。",
  };
}

export function analyzeUsefulGod(input: UsefulGodInput) {
  const hasHourPillar = input.pillars.length === 4;
  const calculators = {
    "fuyi-v1": fuyiPath,
    "yueling-v1": yuelingPath,
    "tiaohou-v1": tiaohouPath,
    "tongguan-v1": tongguanPath,
  } satisfies Record<UsefulGodPathId, typeof fuyiPath>;

  const paths = usefulGodRules.paths.map((rule) => {
    const pathId = rule.pathId as UsefulGodPathId;
    return {
      ...calculators[pathId](input, hasHourPillar),
      label: rule.label,
      reviewStatus: "reviewed" as const,
      epistemicStatus: "research_model" as const,
      sourceIds: [...rule.sourceIds],
    };
  });
  const confirmedElements = unique(input.confirmedElements ?? []);

  return {
    paths,
    consensus: aggregateConsensus(paths, hasHourPillar),
    confirmedElements,
    scoringApplicability:
      hasHourPillar && confirmedElements.length > 0
        ? ("applied" as const)
        : ("missing_input" as const),
    canAutoConfirm: false,
    ruleVersion: "1.0.0",
    schoolId: "four-path-useful-god-v1",
    disclaimer: usefulGodRules.disclaimer,
    uncertainty:
      "当前四路径公式与输入边界已完成产品审计；古籍条目仍有待逐页核对，输出只是低置信度的流派候选，不是确定或唯一的用神结论。",
  };
}
