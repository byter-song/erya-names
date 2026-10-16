import type {
  AssessmentRepository,
  AssessmentWriteError,
  EvidenceReplacement,
  ProjectAssessment,
} from "../../application/ports/AssessmentRepository";
import type { AssessmentRun } from "../../domain/rules/assessmentRun";
import type { CandidateScore } from "../../domain/rules/candidateScore";
import type { RuleEvidence } from "../../domain/rules/result";
import { err, ok, type Result } from "../../domain/shared/result";
import type { EryaDatabase } from "../database/EryaDatabase";

type WritableRunResult = Result<AssessmentRun, AssessmentWriteError>;

export class DexieAssessmentRepository implements AssessmentRepository {
  constructor(private readonly database: EryaDatabase) {}

  async getRun(projectId: string): Promise<AssessmentRun | undefined> {
    return this.database.assessmentRuns.get(projectId);
  }

  async getActiveRun(projectId: string): Promise<AssessmentRun | undefined> {
    return this.database.transaction(
      "r",
      [this.database.profiles, this.database.assessmentRuns],
      async () => {
        const [run, profile] = await Promise.all([
          this.database.assessmentRuns.get(projectId),
          this.database.profiles.get(projectId),
        ]);

        if (
          !run ||
          !profile ||
          run.status !== "running" ||
          run.configRevision !== profile.configRevision
        )
          return undefined;
        return run;
      },
    );
  }

  async startRun(run: AssessmentRun): Promise<Result<AssessmentRun, AssessmentWriteError>> {
    return this.database.transaction(
      "rw",
      [this.database.profiles, this.database.assessmentRuns],
      async () => {
        const profile = await this.database.profiles.get(run.projectId);
        if (!profile || profile.configRevision !== run.configRevision)
          return err("assessment-revision-mismatch");
        if (run.status !== "running") return err("assessment-input-mismatch");

        await this.database.assessmentRuns.put(run);
        return ok(run);
      },
    );
  }

  async cancelRun(input: {
    projectId: string;
    runId: string;
  }): Promise<Result<void, AssessmentWriteError>> {
    return this.database.transaction(
      "rw",
      [this.database.profiles, this.database.assessmentRuns],
      async () => {
        const current = await this.requireWritableRun(input.projectId, input.runId);
        if (!current.ok) return current;

        await this.database.assessmentRuns.put({ ...current.value, status: "cancelled" });
        return ok(undefined);
      },
    );
  }

  async failRun(input: {
    projectId: string;
    runId: string;
  }): Promise<Result<AssessmentRun, AssessmentWriteError>> {
    return this.updateRunStatus(input, "failed");
  }

  async replaceProjectAssessments(input: {
    projectId: string;
    runId: string;
    configRevision: number;
    assessments: ProjectAssessment[];
  }): Promise<Result<void, AssessmentWriteError>> {
    if (!this.areProjectAssessmentsValid(input)) return err("assessment-input-mismatch");

    return this.database.transaction(
      "rw",
      [this.database.profiles, this.database.projectAssessments, this.database.assessmentRuns],
      async () => {
        const current = await this.requireWritableRun(
          input.projectId,
          input.runId,
          input.configRevision,
        );
        if (!current.ok) return current;

        const incomingIds = input.assessments.map(({ id }) => id);
        const existingById = incomingIds.length
          ? await this.database.projectAssessments.bulkGet(incomingIds)
          : [];
        const replacementKeys = new Set(
          input.assessments.map(({ moduleId }) => `${input.projectId}\u0000${moduleId}`),
        );
        if (
          existingById.some(
            (record) =>
              record && !replacementKeys.has(`${record.projectId}\u0000${record.moduleId}`),
          )
        )
          return err("assessment-input-mismatch");

        for (const { moduleId } of input.assessments) {
          await this.database.projectAssessments
            .where("[projectId+moduleId]")
            .equals([input.projectId, moduleId])
            .delete();
        }
        if (input.assessments.length)
          await this.database.projectAssessments.bulkPut(input.assessments);
        return ok(undefined);
      },
    );
  }

  async listProjectAssessments(input: {
    projectId: string;
    configRevision: number;
  }): Promise<ProjectAssessment[]> {
    return this.database.transaction(
      "r",
      [this.database.profiles, this.database.projectAssessments],
      async () => {
        const profile = await this.database.profiles.get(input.projectId);
        if (!profile || profile.configRevision !== input.configRevision) return [];

        const assessments = await this.database.projectAssessments
          .where("projectId")
          .equals(input.projectId)
          .filter(({ configRevision }) => configRevision === input.configRevision)
          .toArray();
        return assessments.sort((left, right) => left.moduleId.localeCompare(right.moduleId));
      },
    );
  }

  async replaceCandidateAssessmentBatch(input: {
    projectId: string;
    runId: string;
    configRevision: number;
    replacements: EvidenceReplacement[];
    scores: CandidateScore[];
    completed: number;
  }): Promise<Result<AssessmentRun, AssessmentWriteError>> {
    if (!this.isCandidateBatchValid(input)) return err("assessment-input-mismatch");

    return this.database.transaction(
      "rw",
      [
        this.database.profiles,
        this.database.candidates,
        this.database.ruleEvidence,
        this.database.candidateScores,
        this.database.assessmentRuns,
      ],
      async () => {
        const current = await this.requireWritableRun(
          input.projectId,
          input.runId,
          input.configRevision,
        );
        if (!current.ok) return current;
        if (input.completed < current.value.completed || input.completed > current.value.total)
          return err("assessment-input-mismatch");

        const candidateIds = [...new Set(input.scores.map(({ candidateId }) => candidateId))];
        const candidates = candidateIds.length
          ? await this.database.candidates.bulkGet(candidateIds)
          : [];
        if (
          candidates.some((candidate) => !candidate || candidate.projectId !== input.projectId)
        )
          return err("assessment-input-mismatch");

        const evidence = input.replacements.flatMap((replacement) => replacement.evidence);
        if (
          !(await this.incomingEvidenceIdsAreSafe(
            input.projectId,
            input.replacements,
            evidence,
          ))
        )
          return err("assessment-input-mismatch");

        const existingScores = candidateIds.length
          ? await this.database.candidateScores.bulkGet(candidateIds)
          : [];
        if (existingScores.some((score) => score && score.projectId !== input.projectId))
          return err("assessment-input-mismatch");

        for (const replacement of input.replacements) {
          const obsoleteIds = await this.database.ruleEvidence
            .where("[candidateId+moduleId]")
            .equals([replacement.candidateId, replacement.moduleId])
            .filter(
              (record) =>
                record.projectId === input.projectId &&
                record.inputHash === replacement.inputHash,
            )
            .primaryKeys();
          if (obsoleteIds.length) await this.database.ruleEvidence.bulkDelete(obsoleteIds);
        }

        if (evidence.length) await this.database.ruleEvidence.bulkPut(evidence);
        if (input.scores.length) await this.database.candidateScores.bulkPut(input.scores);

        const nextRun: AssessmentRun = { ...current.value, completed: input.completed };
        await this.database.assessmentRuns.put(nextRun);
        return ok(nextRun);
      },
    );
  }

  async completeRun(input: {
    projectId: string;
    runId: string;
  }): Promise<Result<AssessmentRun, AssessmentWriteError>> {
    return this.updateRunStatus(input, "completed");
  }

  async listEvidence(input: {
    projectId: string;
    candidateId: string;
    inputHash: string;
  }): Promise<RuleEvidence[]> {
    const evidence = await this.database.ruleEvidence
      .where("[projectId+candidateId]")
      .equals([input.projectId, input.candidateId])
      .filter(({ inputHash }) => inputHash === input.inputHash)
      .toArray();
    return evidence.sort(
      (left, right) =>
        left.moduleId.localeCompare(right.moduleId) || left.id.localeCompare(right.id),
    );
  }

  async getScore(input: {
    projectId: string;
    candidateId: string;
    configRevision: number;
  }): Promise<CandidateScore | undefined> {
    return this.database.transaction(
      "r",
      [this.database.profiles, this.database.candidateScores],
      async () => {
        const [profile, score] = await Promise.all([
          this.database.profiles.get(input.projectId),
          this.database.candidateScores.get(input.candidateId),
        ]);
        if (
          !profile ||
          profile.configRevision !== input.configRevision ||
          !score ||
          score.projectId !== input.projectId ||
          score.configRevision !== input.configRevision
        )
          return undefined;
        return score;
      },
    );
  }

  async listScores(input: {
    projectId: string;
    configRevision: number;
  }): Promise<CandidateScore[]> {
    return this.database.transaction(
      "r",
      [this.database.profiles, this.database.candidateScores],
      async () => {
        const profile = await this.database.profiles.get(input.projectId);
        if (!profile || profile.configRevision !== input.configRevision) return [];

        return this.database.candidateScores
          .where("projectId")
          .equals(input.projectId)
          .filter(({ configRevision }) => configRevision === input.configRevision)
          .sortBy("candidateId");
      },
    );
  }

  private async updateRunStatus(
    input: { projectId: string; runId: string },
    status: "completed" | "failed",
  ): Promise<Result<AssessmentRun, AssessmentWriteError>> {
    return this.database.transaction(
      "rw",
      [this.database.profiles, this.database.assessmentRuns],
      async () => {
        const current = await this.requireWritableRun(input.projectId, input.runId);
        if (!current.ok) return current;
        if (status === "completed" && current.value.completed !== current.value.total)
          return err("assessment-input-mismatch");

        const nextRun: AssessmentRun = { ...current.value, status };
        await this.database.assessmentRuns.put(nextRun);
        return ok(nextRun);
      },
    );
  }

  private async requireWritableRun(
    projectId: string,
    runId: string,
    configRevision?: number,
  ): Promise<WritableRunResult> {
    const [run, profile] = await Promise.all([
      this.database.assessmentRuns.get(projectId),
      this.database.profiles.get(projectId),
    ]);
    if (!run || run.runId !== runId || run.status !== "running")
      return err("assessment-run-stale");

    const expectedRevision = configRevision ?? run.configRevision;
    if (
      !profile ||
      run.configRevision !== expectedRevision ||
      profile.configRevision !== expectedRevision
    )
      return err("assessment-revision-mismatch");
    return ok(run);
  }

  private areProjectAssessmentsValid(input: {
    projectId: string;
    configRevision: number;
    assessments: ProjectAssessment[];
  }): boolean {
    const modules = new Set<string>();
    const ids = new Set<string>();
    for (const assessment of input.assessments) {
      if (
        assessment.projectId !== input.projectId ||
        assessment.configRevision !== input.configRevision ||
        modules.has(assessment.moduleId) ||
        ids.has(assessment.id)
      )
        return false;
      modules.add(assessment.moduleId);
      ids.add(assessment.id);
    }
    return true;
  }

  private isCandidateBatchValid(input: {
    projectId: string;
    configRevision: number;
    replacements: EvidenceReplacement[];
    scores: CandidateScore[];
    completed: number;
  }): boolean {
    if (!Number.isInteger(input.completed) || input.completed < 0) return false;

    const tuples = new Set<string>();
    const candidateHashes = new Map<string, string>();
    const evidenceIds = new Set<string>();
    for (const replacement of input.replacements) {
      const tuple = `${replacement.candidateId}\u0000${replacement.moduleId}\u0000${replacement.inputHash}`;
      if (tuples.has(tuple)) return false;
      tuples.add(tuple);

      const existingHash = candidateHashes.get(replacement.candidateId);
      if (existingHash !== undefined && existingHash !== replacement.inputHash) return false;
      candidateHashes.set(replacement.candidateId, replacement.inputHash);

      for (const evidence of replacement.evidence) {
        if (
          evidenceIds.has(evidence.id) ||
          evidence.projectId !== input.projectId ||
          evidence.candidateId !== replacement.candidateId ||
          evidence.moduleId !== replacement.moduleId ||
          evidence.inputHash !== replacement.inputHash
        )
          return false;
        evidenceIds.add(evidence.id);
      }
    }

    const scoreCandidates = new Set<string>();
    for (const score of input.scores) {
      const evidenceHash = candidateHashes.get(score.candidateId);
      if (
        scoreCandidates.has(score.candidateId) ||
        score.projectId !== input.projectId ||
        score.configRevision !== input.configRevision ||
        (evidenceHash !== undefined && evidenceHash !== score.inputHash)
      )
        return false;
      scoreCandidates.add(score.candidateId);
    }

    return [...candidateHashes.keys()].every((candidateId) => scoreCandidates.has(candidateId));
  }

  private async incomingEvidenceIdsAreSafe(
    projectId: string,
    replacements: EvidenceReplacement[],
    evidence: RuleEvidence[],
  ): Promise<boolean> {
    if (!evidence.length) return true;

    const replacementTuples = new Set(
      replacements.map(
        ({ candidateId, moduleId, inputHash }) =>
          `${projectId}\u0000${candidateId}\u0000${moduleId}\u0000${inputHash}`,
      ),
    );
    const existing = await this.database.ruleEvidence.bulkGet(evidence.map(({ id }) => id));
    return existing.every(
      (record) =>
        !record ||
        replacementTuples.has(
          `${record.projectId}\u0000${record.candidateId}\u0000${record.moduleId}\u0000${record.inputHash}`,
        ),
    );
  }
}
