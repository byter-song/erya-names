import type { GenerationRepository } from "../ports/GenerationRepository";
import type { ProjectRepository } from "../ports/ProjectRepository";
import type { RuntimeBundle } from "../../data/schema/runtimeBundle";
import { generationBatchSchema } from "../../domain/generation/batch";
import { generateCandidates } from "../../domain/generation/generateCandidates";
import { RULE_PACK_VERSION } from "../../domain/rules/rulePack";
import { err, ok, type Result } from "../../domain/shared/result";
import type { ProjectAnalysisOutcome } from "./AnalyzeCurrentProjectCandidates";

export interface GenerateCandidateBatchResult {
  batchId: string;
  candidateIds: string[];
  analysis: ProjectAnalysisOutcome;
}

export class GenerateCandidateBatch {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly generations: GenerationRepository,
    private readonly dependencies: {
      loadBundle: () => RuntimeBundle;
      createBatchId: () => string;
      createCandidateId: (fullName: string) => string;
      now: () => string;
      analyzeCurrentRevision(input: { projectId: string }): Promise<ProjectAnalysisOutcome>;
    },
  ) {}

  async execute(input: {
    projectId: string;
    requestedCount: number;
    allusionRatio: number;
    seed: string;
  }): Promise<Result<GenerateCandidateBatchResult, string>> {
    const workspace = await this.projects.getWorkspace(input.projectId);
    if (!workspace) return err("project-not-found");

    try {
      const bundle = this.dependencies.loadBundle();
      const historicalFingerprints = await this.generations.findHistoricalFingerprints(
        input.projectId,
      );
      const generated = generateCandidates({
        profile: workspace.profile,
        bundle,
        seed: input.seed,
        requestedCount: input.requestedCount,
        allusionRatio: input.allusionRatio,
        historicalFingerprints,
      });
      const batchId = this.dependencies.createBatchId();
      const createdAt = this.dependencies.now();
      // Generation keeps rich, transient material for filtering and ordering. Persist only the
      // v2 candidate fact plus its separately stored source evidence; assessments are produced by
      // the assessment pipeline and must never become a second fact source on the candidate row.
      const candidates = generated.candidates.map((candidate) => ({
        id: this.dependencies.createCandidateId(candidate.fullName),
        projectId: candidate.projectId,
        batchId,
        normalizedFingerprint: candidate.normalizedFingerprint,
        surname: candidate.surname,
        givenName: candidate.givenName,
        fullName: candidate.fullName,
        pinyin: candidate.pinyin,
        sourceType: candidate.sourceType,
        summary: candidate.summary,
        createdAt,
        sourceEvidence: candidate.sourceEvidence,
      }));
      const sequence = (await this.generations.countBatches(input.projectId)) + 1;
      const batch = generationBatchSchema.parse({
        id: batchId,
        projectId: input.projectId,
        sequence,
        seed: input.seed,
        inspirationSources: workspace.profile.inspiration.sources,
        requestedCount: input.requestedCount,
        profileSnapshot: workspace.profile,
        datasetVersion: bundle.manifest.version,
        rulePackVersion: RULE_PACK_VERSION,
        status: "completed",
        statistics: generated.statistics,
        createdAt,
      });

      await this.generations.saveCompletedBatch({ batch, candidates });
      let analysis: ProjectAnalysisOutcome;
      try {
        analysis = await this.dependencies.analyzeCurrentRevision({
          projectId: input.projectId,
        });
      } catch (error) {
        analysis = {
          status: "failed",
          error: error instanceof Error ? error.message : "assessment-run-failed",
        };
      }
      return ok({
        batchId,
        candidateIds: candidates.map((candidate) => candidate.id),
        analysis,
      });
    } catch (error) {
      return err(error instanceof Error ? error.message : "generation-failed");
    }
  }
}
