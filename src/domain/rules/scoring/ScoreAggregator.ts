import type { CandidateScore } from "../candidateScore";
import type { EvidenceStatus, RuleEvidence, RuleModuleId } from "../result";

export type ScoreModuleConfiguration = Readonly<{
  analysisEnabled: boolean;
  detailsVisible: boolean;
  weight: number;
  dimensionWeights: Readonly<Record<string, number>>;
}>;

export type AggregateCandidateScoreInput = Readonly<{
  candidateId: string;
  projectId: string;
  configRevision: number;
  inputHash: string;
  evidence: readonly RuleEvidence[];
  modules: Readonly<Record<RuleModuleId, ScoreModuleConfiguration>>;
}>;

export type CandidateRanking = Readonly<{
  id: string;
  hardStatus: EvidenceStatus;
  totalScore?: number;
  completeness: number;
  rating?: number;
  createdAt: string;
}>;

const HARD_STATUS_ORDER: Readonly<Record<EvidenceStatus, number>> = {
  pass: 0,
  notice: 1,
  unknown: 2,
  conflict: 3,
};

/**
 * Reduces versioned evidence into the disposable score cache.
 *
 * The evidence remains the source of truth: this function only subtracts the
 * deductions recorded by applicable soft rules and never reconstructs evidence
 * from a score.
 */
export function aggregateCandidateScore(input: AggregateCandidateScoreInput): CandidateScore {
  validateInput(input);

  const evidenceByDimension = groupSoftEvidence(input.evidence);
  const moduleScores: CandidateScore["moduleScores"] = {};
  const scoredDeductions: RuleEvidence[] = [];
  let expectedDimensions = 0;
  let evaluatedDimensions = 0;
  let hiddenScoredModuleCount = 0;
  let weightedModuleScores = 0;
  let effectiveModuleWeight = 0;

  for (const [moduleId, module] of moduleEntries(input.modules)) {
    if (!module.analysisEnabled) continue;

    let weightedDimensionScores = 0;
    let effectiveDimensionWeight = 0;

    for (const [dimensionId, dimensionWeight] of Object.entries(module.dimensionWeights)) {
      if (dimensionWeight <= 0) continue;
      const dimensionEvidence =
        evidenceByDimension.get(dimensionKey(moduleId, dimensionId)) ?? [];
      if (
        dimensionEvidence.length > 0 &&
        dimensionEvidence.every((item) => item.applicability === "not_applicable")
      )
        continue;
      expectedDimensions += 1;
      if (!dimensionHasConclusion(dimensionEvidence)) continue;

      const appliedEvidence = dimensionEvidence.filter(
        (item) => item.applicability === "applied",
      );
      const deduction = appliedEvidence.reduce((sum, item) => sum + (item.deduction ?? 0), 0);
      const dimensionScore = clampScore(100 - deduction);

      evaluatedDimensions += 1;
      weightedDimensionScores += dimensionScore * dimensionWeight;
      effectiveDimensionWeight += dimensionWeight;
      scoredDeductions.push(...appliedEvidence.filter((item) => (item.deduction ?? 0) > 0));
    }

    if (effectiveDimensionWeight === 0) continue;

    const moduleScore = weightedDimensionScores / effectiveDimensionWeight;
    moduleScores[moduleId] = moduleScore;
    if (moduleId !== "basic" && !module.detailsVisible) hiddenScoredModuleCount += 1;

    if (module.weight > 0) {
      weightedModuleScores += moduleScore * module.weight;
      effectiveModuleWeight += module.weight;
    }
  }

  const completeness = expectedDimensions === 0 ? 0 : evaluatedDimensions / expectedDimensions;
  const totalScore =
    effectiveModuleWeight === 0 ? undefined : weightedModuleScores / effectiveModuleWeight;

  return {
    candidateId: input.candidateId,
    projectId: input.projectId,
    configRevision: input.configRevision,
    inputHash: input.inputHash,
    hardStatus: aggregateHardStatus(input.evidence, input.modules),
    ...(totalScore === undefined ? {} : { totalScore }),
    completeness,
    evaluatedDimensions,
    expectedDimensions,
    hiddenScoredModuleCount,
    moduleScores,
    topDeductions: scoredDeductions
      .map(({ ruleId, deduction, explanation }) => ({
        ruleId,
        deduction: deduction ?? 0,
        explanation,
      }))
      .sort(
        (left, right) =>
          right.deduction - left.deduction || compareText(left.ruleId, right.ruleId),
      ),
  };
}

/** Default candidate order from technical-design section 6.2. */
export function compareCandidateRanking(
  left: CandidateRanking,
  right: CandidateRanking,
): number {
  return (
    HARD_STATUS_ORDER[left.hardStatus] - HARD_STATUS_ORDER[right.hardStatus] ||
    compareOptionalScoreDescending(left.totalScore, right.totalScore) ||
    right.completeness - left.completeness ||
    (right.rating ?? 0) - (left.rating ?? 0) ||
    compareText(left.createdAt, right.createdAt) ||
    compareText(left.id, right.id)
  );
}

function aggregateHardStatus(
  evidence: readonly RuleEvidence[],
  modules: Readonly<Record<RuleModuleId, ScoreModuleConfiguration>>,
): EvidenceStatus {
  let hardStatus: EvidenceStatus = "pass";
  for (const item of evidence) {
    if (
      item.severity !== "hard" ||
      !modules[item.moduleId].analysisEnabled ||
      item.applicability === "not_applicable"
    )
      continue;
    if (HARD_STATUS_ORDER[item.status] > HARD_STATUS_ORDER[hardStatus])
      hardStatus = item.status;
  }
  return hardStatus;
}

function groupSoftEvidence(evidence: readonly RuleEvidence[]): Map<string, RuleEvidence[]> {
  const groups = new Map<string, RuleEvidence[]>();
  for (const item of evidence) {
    if (item.severity !== "soft") continue;
    const key = dimensionKey(item.moduleId, item.dimensionId);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

function dimensionHasConclusion(evidence: readonly RuleEvidence[]): boolean {
  if (
    evidence.some(
      (item) =>
        item.applicability === "missing_input" || item.applicability === "source_unverified",
    )
  )
    return false;
  return evidence.some((item) => item.applicability === "applied");
}

function moduleEntries(
  modules: Readonly<Record<RuleModuleId, ScoreModuleConfiguration>>,
): Array<[RuleModuleId, ScoreModuleConfiguration]> {
  return Object.entries(modules) as Array<[RuleModuleId, ScoreModuleConfiguration]>;
}

function dimensionKey(moduleId: RuleModuleId, dimensionId: string): string {
  return `${moduleId}\u0000${dimensionId}`;
}

function clampScore(score: number): number {
  return Math.min(100, Math.max(0, score));
}

function compareOptionalScoreDescending(left?: number, right?: number): number {
  if (left === undefined) return right === undefined ? 0 : 1;
  if (right === undefined) return -1;
  return right - left;
}

function compareText(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function validateInput(input: AggregateCandidateScoreInput): void {
  for (const [moduleId, module] of moduleEntries(input.modules)) {
    assertWeight(module.weight, `module ${moduleId}`);
    for (const [dimensionId, weight] of Object.entries(module.dimensionWeights))
      assertWeight(weight, `dimension ${moduleId}.${dimensionId}`);
  }

  for (const item of input.evidence) {
    if (
      item.candidateId !== input.candidateId ||
      item.projectId !== input.projectId ||
      item.inputHash !== input.inputHash
    )
      throw new Error("ScoreAggregator received evidence for a different scoring input");
    if (
      item.deduction !== undefined &&
      (!Number.isFinite(item.deduction) || item.deduction < 0)
    )
      throw new Error("ScoreAggregator deductions must be finite and non-negative");
  }
}

function assertWeight(weight: number, label: string): void {
  if (!Number.isFinite(weight) || weight < 0)
    throw new Error(`ScoreAggregator ${label} weight must be finite and non-negative`);
}
