import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { RecordCandidateEvaluation } from "../../src/application/use-cases/RecordCandidateEvaluation";
import { RecalculateProjectAssessments } from "../../src/application/use-cases/RecalculateProjectAssessments";
import { activeRuntimeBundle } from "../../src/data/activeRuntimeBundle";
import type { Candidate } from "../../src/domain/candidate/candidate";
import { CandidateAssessmentEngine } from "../../src/domain/rules/CandidateAssessmentEngine";
import { EryaDatabase } from "../../src/infrastructure/database/EryaDatabase";
import { DexieAssessmentRepository } from "../../src/infrastructure/repositories/DexieAssessmentRepository";
import { DexieEvaluationRepository } from "../../src/infrastructure/repositories/DexieEvaluationRepository";
import { DexieGenerationRepository } from "../../src/infrastructure/repositories/DexieGenerationRepository";
import { DexieProjectRepository } from "../../src/infrastructure/repositories/DexieProjectRepository";
import { namingProfileFixture } from "../fixtures/namingProfile";

const databaseNames = new Set<string>();

afterEach(async () => {
  await Promise.all([...databaseNames].map((name) => EryaDatabase.delete(name)));
  databaseNames.clear();
});

describe("single-user candidate evaluation", () => {
  it("persists auditable evidence before the derived candidate score", async () => {
    const name = `erya-assessment-${crypto.randomUUID()}`;
    databaseNames.add(name);
    const database = new EryaDatabase(name);
    const profile = { ...namingProfileFixture("project-song"), configRevision: 1 };
    const candidate = candidateFixture();
    await database.transaction(
      "rw",
      [
        database.projects,
        database.profiles,
        database.candidates,
        database.candidateDecisions,
        database.assessmentRuns,
      ],
      async () => {
        await database.projects.add({
          id: profile.projectId,
          title: "宋姓评分方案",
          stage: "naming",
          status: "active",
          createdAt: "2026-10-16T00:00:00.000Z",
          updatedAt: "2026-10-16T00:00:00.000Z",
        });
        await database.profiles.add(profile);
        await database.candidates.add(candidate);
        await database.candidateDecisions.add({
          candidateId: candidate.id,
          projectId: profile.projectId,
          pool: "inspiration",
          updatedAt: "2026-10-16T00:00:00.000Z",
        });
        await database.assessmentRuns.add({
          projectId: profile.projectId,
          runId: "run-score",
          configRevision: 1,
          status: "running",
          completed: 0,
          total: 1,
        });
      },
    );
    const engine = new CandidateAssessmentEngine();
    const useCase = new RecalculateProjectAssessments(
      new DexieProjectRepository(database),
      new DexieGenerationRepository(database),
      new DexieAssessmentRepository(database),
      {
        batchSize: 50,
        scheduler: { schedule: (task) => queueMicrotask(task) },
        evaluateCandidate: ({ candidate: current, profile: currentProfile }) => {
          const inputHash = `revision:${currentProfile.configRevision}:${current.id}`;
          const result = engine.assess({
            candidate: current,
            profile: currentProfile,
            bundle: activeRuntimeBundle,
            inputHash,
            facts: assessmentFacts(current),
            folklore: researchOnlyFolklore(),
          });
          return {
            replacements: [...new Set(result.evidence.map(({ moduleId }) => moduleId))].map(
              (moduleId) => ({
                candidateId: current.id,
                moduleId,
                inputHash,
                evidence: result.evidence.filter((item) => item.moduleId === moduleId),
              }),
            ),
            score: result.score,
          };
        },
      },
    );

    await expect(
      useCase.recalculate({ projectId: profile.projectId, runId: "run-score" }),
    ).resolves.toEqual({ ok: true, value: undefined });
    const evidence = await database.ruleEvidence
      .where("candidateId")
      .equals(candidate.id)
      .toArray();
    const score = await database.candidateScores.get(candidate.id);
    expect(evidence.length).toBeGreaterThanOrEqual(8);
    expect(score).toMatchObject({
      candidateId: candidate.id,
      inputHash: `revision:1:${candidate.id}`,
      configRevision: 1,
    });
    expect(score?.moduleScores.basic).toBeDefined();
    expect(new Set(evidence.map(({ inputHash }) => inputHash))).toEqual(
      new Set([score?.inputHash]),
    );
    database.close();
  });

  it("persists one rating and note per candidate", async () => {
    const name = `erya-evaluation-${crypto.randomUUID()}`;
    databaseNames.add(name);
    const database = new EryaDatabase(name);
    await database.candidates.add(candidateFixture());
    const useCase = new RecordCandidateEvaluation(new DexieEvaluationRepository(database), {
      now: () => "2026-09-17T02:00:00.000Z",
    });

    const saved = await useCase.execute({
      projectId: "project-song",
      candidateId: "candidate-song-qingyang",
      rating: 5,
      note: "读音清朗，出处可信",
    });

    expect(saved.ok).toBe(true);
    await expect(
      database.candidateEvaluations.get("candidate-song-qingyang"),
    ).resolves.toMatchObject({
      rating: 5,
      note: "读音清朗，出处可信",
    });
    database.close();
  });

  it("rejects ratings outside one to five", async () => {
    const name = `erya-evaluation-${crypto.randomUUID()}`;
    databaseNames.add(name);
    const database = new EryaDatabase(name);
    const result = await new RecordCandidateEvaluation(
      new DexieEvaluationRepository(database),
      {
        now: () => "2026-09-17T02:00:00.000Z",
      },
    ).execute({
      projectId: "project-song",
      candidateId: "candidate-song-qingyang",
      rating: 6,
      note: "invalid",
    });

    expect(result).toEqual({ ok: false, error: "评分必须在 1 到 5 之间" });
    database.close();
  });

  it("rejects a candidate that does not belong to the project", async () => {
    const name = `erya-evaluation-${crypto.randomUUID()}`;
    databaseNames.add(name);
    const database = new EryaDatabase(name);
    await database.candidates.add({
      id: "candidate-other",
      projectId: "project-other",
      batchId: null,
      normalizedFingerprint: "宋清扬",
      surname: "宋",
      givenName: "清扬",
      fullName: "宋清扬",
      pinyin: [],
      sourceType: "user_input",
      summary: "",
      sourceIds: [],
      sourceEvidence: [],
      warnings: [],
      riskSignals: [],
      ruleResults: [],
      styleTags: [],
      characterElements: [],
      createdAt: "2026-09-17T00:00:00.000Z",
    });
    const result = await new RecordCandidateEvaluation(
      new DexieEvaluationRepository(database),
      {
        now: () => "2026-09-17T02:00:00.000Z",
      },
    ).execute({ projectId: "project-song", candidateId: "candidate-other", rating: 5 });
    expect(result).toEqual({ ok: false, error: "candidate-project-mismatch" });
    database.close();
  });
});

function candidateFixture() {
  return {
    id: "candidate-song-qingyang",
    projectId: "project-song",
    batchId: null,
    normalizedFingerprint: "宋清扬",
    surname: "宋",
    givenName: "清扬",
    fullName: "宋清扬",
    pinyin: [],
    sourceType: "user_input" as const,
    summary: "",
    sourceIds: [],
    sourceEvidence: [],
    warnings: [],
    riskSignals: [],
    ruleResults: [],
    styleTags: [],
    characterElements: [],
    createdAt: "2026-09-17T00:00:00.000Z",
  };
}

function assessmentFacts(candidate: Candidate) {
  const cards = [...candidate.givenName]
    .map((character) => activeRuntimeBundle.characters.find(({ char }) => char === character))
    .filter((card) => card !== undefined);
  return {
    sourceIds: ["manual-candidate"],
    sourceRiskSignals: cards.flatMap(({ riskSignals }) => riskSignals),
    styleTags: [...new Set(cards.flatMap(({ styleTags }) => styleTags))],
    characterElements: cards.flatMap(({ element }) => (element ? [element] : [])),
    characterStrokeCounts: cards.flatMap(({ strokes }) => (strokes ? [strokes] : [])),
  };
}

function researchOnlyFolklore() {
  const pack = (sourceId: string) => ({
    reviewStatus: "research_only" as const,
    sourceIds: [sourceId],
  });
  return {
    baziWuxing: { pack: pack("useful-god-research"), noMatchDeduction: 10 },
    zodiac: { pack: pack("zodiac-research"), rules: [] },
    traditional: {
      pack: pack("traditional-research"),
      principleTags: [],
      tabooRules: [],
    },
    nameHexagram: {
      pack: pack("hexagram-research"),
      strokeSourceIds: ["kangxi-research"],
      strokeRecords: [],
    },
    fiveGrids: {
      pack: pack("five-grids-research"),
      strokeSourceIds: ["kangxi-research"],
      strokeRecords: [],
      meanings: [],
    },
  };
}
