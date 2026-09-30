import type { GenerationRepository } from "../ports/GenerationRepository";
import type { ProjectRepository } from "../ports/ProjectRepository";
import type { RuntimeBundle } from "../../data/schema/runtimeBundle";
import { generationBatchSchema } from "../../domain/generation/batch";
import { generateCandidates } from "../../domain/generation/generateCandidates";
import { RULE_PACK_VERSION } from "../../domain/rules/rulePack";
import { err, ok, type Result } from "../../domain/shared/result";

export class GenerateCandidateBatch {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly generations: GenerationRepository,
    private readonly dependencies: {
      loadBundle: () => RuntimeBundle;
      createBatchId: () => string;
      createCandidateId: (fullName: string) => string;
      now: () => string;
    },
  ) {}

  async execute(input: {
    projectId: string;
    requestedCount: number;
    allusionRatio: number;
    seed: string;
  }): Promise<Result<{ batchId: string; candidateIds: string[] }, string>> {
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
      const candidates = generated.candidates.map((candidate) => ({
        ...candidate,
        id: this.dependencies.createCandidateId(candidate.fullName),
        batchId,
        createdAt,
      }));
      const sequence = (await this.generations.countBatches(input.projectId)) + 1;
      const batch = generationBatchSchema.parse({
        id: batchId,
        projectId: input.projectId,
        sequence,
        seed: input.seed,
        requestedCount: input.requestedCount,
        profileSnapshot: workspace.profile,
        datasetVersion: bundle.manifest.version,
        rulePackVersion: RULE_PACK_VERSION,
        status: "completed",
        statistics: generated.statistics,
        createdAt,
      });

      await this.generations.saveCompletedBatch({ batch, candidates });
      return ok({ batchId, candidateIds: candidates.map((candidate) => candidate.id) });
    } catch (error) {
      return err(error instanceof Error ? error.message : "generation-failed");
    }
  }
}
