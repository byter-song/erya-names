import type {
  GenerationRepository,
  PersistedGeneratedCandidate,
} from "../../application/ports/GenerationRepository";
import type { GenerationBatch } from "../../domain/generation/batch";
import type { CandidateDecision } from "../../domain/candidate/decision";
import type { EryaDatabase } from "../database/EryaDatabase";
import type { RuleResultRecord } from "../database/schema";
import type { CandidateRuleResult } from "../../domain/rules/types";
import {
  calculateSystemScore,
  getSystemScoreEvidence,
} from "../../domain/rules/scoring/systemScore";

export class DexieGenerationRepository implements GenerationRepository {
  constructor(private readonly database: EryaDatabase) {}

  async findHistoricalFingerprints(projectId: string): Promise<Set<string>> {
    const candidates = await this.database.candidates
      .where("projectId")
      .equals(projectId)
      .toArray();
    return new Set(candidates.map((candidate) => candidate.normalizedFingerprint));
  }

  async countBatches(projectId: string): Promise<number> {
    return this.database.generationBatches.where("projectId").equals(projectId).count();
  }

  async listCandidates(projectId: string, stages?: CandidateDecision["stage"][]) {
    const selectedDecisions = stages?.length
      ? (
          await Promise.all(
            stages.map((stage) =>
              this.database.candidateDecisions
                .where("[projectId+stage]")
                .equals([projectId, stage])
                .toArray(),
            ),
          )
        ).flat()
      : await this.database.candidateDecisions.where("projectId").equals(projectId).toArray();
    const candidateIds = selectedDecisions.map((decision) => decision.candidateId);
    if (candidateIds.length === 0) return [];
    const [candidateRows, ruleResults] = await Promise.all([
      this.database.candidates.bulkGet(candidateIds),
      this.database.ruleResults.where("candidateId").anyOf(candidateIds).toArray(),
    ]);
    const candidates = candidateRows.filter(
      (candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate),
    );
    const decisions = selectedDecisions;
    const decisionsById = new Map(
      decisions
        .filter((decision): decision is NonNullable<typeof decision> => Boolean(decision))
        .map((decision) => [decision.candidateId, decision as CandidateDecision]),
    );

    const rulesByCandidate = new Map<string, typeof ruleResults>();
    for (const rule of ruleResults) {
      const group = rulesByCandidate.get(rule.candidateId) ?? [];
      group.push(rule);
      rulesByCandidate.set(rule.candidateId, group);
    }
    return candidates.flatMap((candidate) => {
      const decision = decisionsById.get(candidate.id);
      if (!decision) return [];
      const candidateRules = rulesByCandidate.get(candidate.id) ?? [];
      const domainRules: CandidateRuleResult[] = candidateRules.map((result) => ({
        evidenceLevel: result.evidenceLevel,
        outcome: result.outcome,
        ruleId: result.ruleId,
        ruleVersion: result.ruleVersion,
        explanation: result.explanation,
        sourceRefs: result.sourceRefs,
        ...(result.scoreDelta !== undefined ? { scoreDelta: result.scoreDelta } : {}),
      }));
      const scoreEvidence = getSystemScoreEvidence(domainRules);
      return [
        {
          candidate: candidate as PersistedGeneratedCandidate,
          decision,
          warnings: candidateRules
            .filter((result) => result.outcome === "warn")
            .map((result) => ({
              evidenceLevel: result.evidenceLevel,
              outcome: result.outcome,
              ruleId: result.ruleId,
              ruleVersion: result.ruleVersion,
              explanation: result.explanation,
              sourceRefs: result.sourceRefs,
              ...(result.scoreDelta !== undefined ? { scoreDelta: result.scoreDelta } : {}),
            })),
          systemScore: calculateSystemScore(domainRules),
          scoreEvidence: scoreEvidence.map((result) => ({
            evidenceLevel: result.evidenceLevel,
            outcome: result.outcome,
            ruleId: result.ruleId,
            ruleVersion: result.ruleVersion,
            explanation: result.explanation,
            sourceRefs: result.sourceRefs,
            ...(result.scoreDelta !== undefined ? { scoreDelta: result.scoreDelta } : {}),
          })),
          ruleEvidence: candidateRules.map((result) => ({
            evidenceLevel: result.evidenceLevel,
            outcome: result.outcome,
            ruleId: result.ruleId,
            ruleVersion: result.ruleVersion,
            explanation: result.explanation,
            sourceRefs: result.sourceRefs,
            ...(result.scoreDelta !== undefined ? { scoreDelta: result.scoreDelta } : {}),
          })),
        },
      ];
    });
  }

  async saveCompletedBatch(input: {
    batch: GenerationBatch;
    candidates: PersistedGeneratedCandidate[];
  }): Promise<void> {
    await this.database.transaction(
      "rw",
      [
        this.database.generationBatches,
        this.database.candidates,
        this.database.candidateSources,
        this.database.ruleResults,
        this.database.candidateDecisions,
      ],
      async () => {
        // Two tabs may generate from the same history snapshot; reject the stale write atomically.
        if (input.candidates.length) {
          const duplicates = await this.database.candidates
            .where("[projectId+normalizedFingerprint]")
            .anyOf(
              input.candidates.map((candidate) => [
                candidate.projectId,
                candidate.normalizedFingerprint,
              ]),
            )
            .count();
          if (duplicates)
            throw new Error(
              "另一个窗口已保存了部分同名结果，请重新生成这一批；已有名字未受影响。",
            );
        }
        await this.database.generationBatches.add(input.batch);
        await this.database.candidates.bulkAdd(input.candidates);
        const sourceRecords = input.candidates.flatMap((candidate) =>
          candidate.sourceEvidence.map((source, index) => ({
            id: `${candidate.id}:source:${index + 1}`,
            projectId: candidate.projectId,
            candidateId: candidate.id,
            ...source,
          })),
        );
        if (sourceRecords.length > 0)
          await this.database.candidateSources.bulkAdd(sourceRecords);

        const ruleRecords = input.candidates.flatMap<RuleResultRecord>((candidate) => {
          const evaluated = candidate.ruleResults.map((result, index): RuleResultRecord => ({
            id: `${candidate.id}:${result.ruleId}:${index + 1}`,
            projectId: candidate.projectId,
            candidateId: candidate.id,
            evidenceLevel: result.evidenceLevel,
            outcome: result.outcome,
            ruleId: result.ruleId,
            ruleVersion: result.ruleVersion,
            explanation: result.explanation,
            sourceRefs: result.sourceRefs,
            ...(result.scoreDelta !== undefined ? { scoreDelta: result.scoreDelta } : {}),
          }));
          return evaluated;
        });
        await this.database.ruleResults.bulkAdd(ruleRecords);
        await this.database.candidateDecisions.bulkAdd(
          input.candidates.map((candidate) => ({
            candidateId: candidate.id,
            projectId: candidate.projectId,
            stage: "inbox",
            updatedAt: candidate.createdAt,
          })),
        );
      },
    );
  }
}
