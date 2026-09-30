import type { Transaction } from "dexie";
import { V1_STORES } from "./v1";
import type { CandidateRecord, RuleResultRecord } from "../schema";
import type { CandidateEvaluation } from "../../../domain/candidate/evaluation";

export const V2_STORES = V1_STORES;

export async function upgradeToV2(transaction: Transaction): Promise<void> {
  const snapshots = transaction.table("comparisonSnapshots");
  const candidates = transaction.table<CandidateRecord>("candidates");
  const rules = transaction.table<RuleResultRecord>("ruleResults");
  const evaluations = transaction.table<CandidateEvaluation>("candidateEvaluations");

  const legacySnapshots = (await snapshots.toArray()) as Array<Record<string, unknown>>;
  const upgraded: Array<Record<string, unknown>> = [];
  const obsoleteIds: string[] = [];
  for (const snapshot of legacySnapshots) {
    if (Array.isArray(snapshot.candidates) && typeof snapshot.name === "string") continue;
    const candidateIds = Array.isArray(snapshot.candidateIds)
      ? snapshot.candidateIds.map(String)
      : [];
    if (candidateIds.length < 2 || candidateIds.length > 5) {
      if (typeof snapshot.id === "string") obsoleteIds.push(snapshot.id);
      continue;
    }
    const records = await candidates.bulkGet(candidateIds);
    if (records.some((record) => !record)) {
      if (typeof snapshot.id === "string") obsoleteIds.push(snapshot.id);
      continue;
    }
    const [allRules, allEvaluations] = await Promise.all([
      rules.where("candidateId").anyOf(candidateIds).toArray(),
      evaluations.where("candidateId").anyOf(candidateIds).toArray(),
    ]);
    const evaluationMap = new Map(allEvaluations.map((item) => [item.candidateId, item]));
    const capturedCandidates = records.flatMap((candidate) => {
      if (!candidate) return [];
      const candidateRules = allRules.filter((rule) => rule.candidateId === candidate.id);
      const evaluation = evaluationMap.get(candidate.id);
      return [
        {
          id: candidate.id,
          fullName: candidate.fullName,
          pinyin: candidate.pinyin,
          sourceType: candidate.sourceType,
          summary: candidate.summary,
          sourceEvidence: candidate.sourceEvidence ?? [],
          warnings: candidateRules
            .filter((rule) => rule.outcome === "warn")
            .map(({ ruleId, ruleVersion, explanation, sourceRefs }) => ({
              ruleId,
              ruleVersion,
              explanation,
              sourceRefs,
            })),
          ruleEvidence: candidateRules.map(
            ({
              evidenceLevel,
              outcome,
              ruleId,
              ruleVersion,
              explanation,
              sourceRefs,
              scoreDelta,
            }) => ({
              evidenceLevel,
              outcome,
              ruleId,
              ruleVersion,
              explanation,
              sourceRefs,
              ...(scoreDelta !== undefined ? { scoreDelta } : {}),
            }),
          ),
          ...(evaluation?.rating !== undefined ? { rating: evaluation.rating } : {}),
          ...(evaluation?.note !== undefined ? { note: evaluation.note } : {}),
        },
      ];
    });
    upgraded.push({
      ...snapshot,
      name: `历史对比 ${String(snapshot.createdAt ?? "")
        .slice(0, 16)
        .replace("T", " ")}`.trim(),
      candidates: capturedCandidates,
    });
  }
  if (upgraded.length > 0) await snapshots.bulkPut(upgraded);
  if (obsoleteIds.length > 0) await snapshots.bulkDelete(obsoleteIds);
}
