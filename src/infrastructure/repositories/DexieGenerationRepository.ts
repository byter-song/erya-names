import type {
  GenerationRepository,
  PersistedGeneratedCandidate,
} from "../../application/ports/GenerationRepository";
import { candidateSchema, type Candidate } from "../../domain/candidate/candidate";
import {
  candidateDecisionSchema,
  type CandidateDecision,
} from "../../domain/candidate/decision";
import type { CandidateSourceEvidence } from "../../domain/candidate/sourceEvidence";
import type { GenerationBatch } from "../../domain/generation/batch";
import type { EryaDatabase } from "../database/EryaDatabase";
import type { CandidateSourceRecord } from "../database/schema";

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

  async listCandidates(projectId: string, pools?: CandidateDecision["pool"][]) {
    const decisions = pools?.length
      ? (
          await Promise.all(
            [...new Set(pools)].map((pool) =>
              this.database.candidateDecisions
                .where("[projectId+pool]")
                .equals([projectId, pool])
                .toArray(),
            ),
          )
        ).flat()
      : await this.database.candidateDecisions.where("projectId").equals(projectId).toArray();
    if (decisions.length === 0) return [];

    const candidateIds = decisions.map((decision) => decision.candidateId);
    const [candidateRows, sourceRows] = await Promise.all([
      this.database.candidates.bulkGet(candidateIds),
      this.database.candidateSources.where("candidateId").anyOf(candidateIds).toArray(),
    ]);
    const sourcesByCandidate = groupSources(sourceRows);
    const decisionsByCandidate = new Map(
      decisions.map((decision) => [
        decision.candidateId,
        candidateDecisionSchema.parse(decision),
      ]),
    );

    return candidateRows.flatMap((row) => {
      if (!row) return [];
      const candidate = candidateSchema.parse(row);
      const decision = decisionsByCandidate.get(candidate.id);
      if (!decision) return [];
      return [
        {
          candidate,
          decision,
          sources: sourcesByCandidate.get(candidate.id) ?? [],
        },
      ];
    });
  }

  async saveCompletedBatch(input: {
    batch: GenerationBatch;
    candidates: PersistedGeneratedCandidate[];
  }): Promise<void> {
    const candidates = input.candidates.map(toCandidateRecord);
    const decisions = candidates.map((candidate) =>
      candidateDecisionSchema.parse({
        candidateId: candidate.id,
        projectId: candidate.projectId,
        pool: "inspiration",
        updatedAt: candidate.createdAt,
      }),
    );
    const sourceRecords = input.candidates.flatMap(toSourceRecords);

    await this.database.transaction(
      "rw",
      [
        this.database.generationBatches,
        this.database.candidates,
        this.database.candidateSources,
        this.database.candidateDecisions,
      ],
      async () => {
        if (candidates.length > 0) {
          const duplicateCount = await this.database.candidates
            .where("[projectId+normalizedFingerprint]")
            .anyOf(
              candidates.map((candidate) => [
                candidate.projectId,
                candidate.normalizedFingerprint,
              ]),
            )
            .count();
          if (duplicateCount > 0)
            throw new Error(
              "另一个窗口已保存了部分同名结果，请重新生成这一批；已有名字未受影响。",
            );
        }

        await this.database.generationBatches.add(input.batch);
        if (candidates.length > 0) {
          await this.database.candidates.bulkAdd(candidates);
          await this.database.candidateDecisions.bulkAdd(decisions);
        }
        if (sourceRecords.length > 0)
          await this.database.candidateSources.bulkAdd(sourceRecords);
      },
    );
  }
}

function toCandidateRecord(candidate: PersistedGeneratedCandidate): Candidate {
  return candidateSchema.parse({
    id: candidate.id,
    projectId: candidate.projectId,
    batchId: candidate.batchId,
    normalizedFingerprint: candidate.normalizedFingerprint,
    surname: candidate.surname,
    givenName: candidate.givenName,
    fullName: candidate.fullName,
    pinyin: candidate.pinyin,
    sourceType: candidate.sourceType,
    summary: candidate.summary,
    createdAt: candidate.createdAt,
  });
}

function toSourceRecords(candidate: PersistedGeneratedCandidate): CandidateSourceRecord[] {
  return candidate.sourceEvidence.map((source, index) => ({
    id: `${candidate.id}:source:${index + 1}`,
    projectId: candidate.projectId,
    candidateId: candidate.id,
    ...source,
  }));
}

function groupSources(
  records: CandidateSourceRecord[],
): Map<string, CandidateSourceEvidence[]> {
  const grouped = new Map<string, CandidateSourceEvidence[]>();
  for (const record of records) {
    const source: CandidateSourceEvidence = {
      sourceId: record.sourceId,
      ...(record.title ? { title: record.title } : {}),
      ...(record.work ? { work: record.work } : {}),
      ...(record.quote ? { quote: record.quote } : {}),
      ...(record.location ? { location: record.location } : {}),
      ...(record.excerpt ? { excerpt: record.excerpt } : {}),
      ...(record.url ? { url: record.url } : {}),
      ...(record.revision ? { revision: record.revision } : {}),
    };
    const current = grouped.get(record.candidateId) ?? [];
    current.push(source);
    grouped.set(record.candidateId, current);
  }
  return grouped;
}
