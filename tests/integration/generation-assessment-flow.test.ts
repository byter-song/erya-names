import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApplicationContainer } from "../../src/infrastructure/container";
import { EryaDatabase } from "../../src/infrastructure/database/EryaDatabase";
import { AnalyzeCurrentProjectCandidates } from "../../src/application/use-cases/AnalyzeCurrentProjectCandidates";
import { DexieAssessmentRepository } from "../../src/infrastructure/repositories/DexieAssessmentRepository";
import { DexieGenerationRepository } from "../../src/infrastructure/repositories/DexieGenerationRepository";
import { DexieProjectRepository } from "../../src/infrastructure/repositories/DexieProjectRepository";

const databaseNames = new Set<string>();

beforeEach(() => vi.stubGlobal("__APP_VERSION__", "0.3.0"));

afterEach(async () => {
  await Promise.all([...databaseNames].map((name) => EryaDatabase.delete(name)));
  databaseNames.clear();
  vi.unstubAllGlobals();
});

describe("project creation to generated candidate detail", () => {
  it("automatically completes current-revision folklore and candidate analysis", async () => {
    const name = `erya-generation-assessment-${crypto.randomUUID()}`;
    databaseNames.add(name);
    const database = new EryaDatabase(name);
    const ids = ["project-auto-assessment", "run-auto-assessment"];
    const container = createApplicationContainer({
      database,
      createId: () => ids.shift() ?? crypto.randomUUID(),
      now: () => "2026-10-16T02:00:00.000Z",
    });

    const created = await container.createNamingProject?.execute({
      title: "宋姓民俗起名",
      surname: "宋",
      surnameType: "single",
      givenNameLength: 2,
      completeOnboarding: true,
      profile: {
        family: { constraintKnowledge: "none" },
        calendar: {
          birthLocalDateTime: "2026-10-16T08:30",
          timeKnown: true,
          zodiacConvention: "pillar",
        },
        modules: {
          bazi_wuxing: {
            analysisEnabled: true,
            detailsVisible: true,
            weight: 30,
            schoolId: "bazi-wuxing-v1",
            ruleVersion: "bazi-wuxing-v1",
          },
        },
      },
    });
    expect(created).toEqual({ ok: true, value: { projectId: "project-auto-assessment" } });

    const generated = await container.generateCandidateBatch?.execute({
      projectId: "project-auto-assessment",
      requestedCount: 4,
      allusionRatio: 0.5,
      seed: "create-generate-score-detail",
    });

    expect(generated).toMatchObject({
      ok: true,
      value: {
        candidateIds: expect.any(Array),
        analysis: { status: "completed", runId: "run-auto-assessment" },
      },
    });
    if (!generated?.ok) throw new Error("generation-failed");
    expect(generated.value.candidateIds).toHaveLength(4);

    await expect(
      container.getAssessmentRun?.execute("project-auto-assessment"),
    ).resolves.toEqual({
      projectId: "project-auto-assessment",
      runId: "run-auto-assessment",
      configRevision: 0,
      status: "completed",
      completed: 4,
      total: 4,
    });
    const funnel = await container.getCandidateFunnel?.execute("project-auto-assessment");
    expect(funnel).toHaveLength(4);
    expect(funnel?.every(({ scoringPending }) => !scoringPending)).toBe(true);
    expect(funnel?.every(({ totalScore }) => totalScore !== undefined)).toBe(true);

    const candidateId = generated.value.candidateIds[0]!;
    const detail = await container.getCandidateDetail?.execute(
      "project-auto-assessment",
      candidateId,
    );
    expect(detail?.candidate).toMatchObject({
      id: candidateId,
      scoringPending: false,
      hardStatus: expect.stringMatching(/pass|notice|conflict|unknown/),
    });
    expect(detail?.evidence.some(({ moduleId }) => moduleId === "basic")).toBe(true);
    expect(detail?.evidence.some(({ moduleId }) => moduleId === "bazi_wuxing")).toBe(true);
    expect(
      await database.projectAssessments
        .where("projectId")
        .equals("project-auto-assessment")
        .count(),
    ).toBeGreaterThan(0);
    database.close();
  });

  it("persists a failed run and can replace it with an explicit retry", async () => {
    const name = `erya-generation-retry-${crypto.randomUUID()}`;
    databaseNames.add(name);
    const database = new EryaDatabase(name);
    const container = createApplicationContainer({
      database,
      createId: () => "project-retry",
      now: () => "2026-10-16T02:00:00.000Z",
    });
    await container.createNamingProject?.execute({
      title: "失败恢复",
      surname: "宋",
      surnameType: "single",
      givenNameLength: 2,
    });

    const projects = new DexieProjectRepository(database);
    const generations = new DexieGenerationRepository(database);
    const assessments = new DexieAssessmentRepository(database);
    const failed = new AnalyzeCurrentProjectCandidates(
      projects,
      generations,
      assessments,
      { execute: async () => ({ ok: false as const, error: "project-analysis-failed" }) },
      { recalculate: async () => ({ ok: true as const, value: undefined }) },
      { createRunId: () => "run-failed" },
    );

    await expect(failed.execute({ projectId: "project-retry" })).resolves.toEqual({
      status: "failed",
      runId: "run-failed",
      error: "project-analysis-failed",
    });
    await expect(assessments.getRun("project-retry")).resolves.toMatchObject({
      runId: "run-failed",
      status: "failed",
    });

    const retried = new AnalyzeCurrentProjectCandidates(
      projects,
      generations,
      assessments,
      {
        execute: async () => ({
          ok: true as const,
          value: { assessments: [], reused: true },
        }),
      },
      {
        recalculate: async ({ projectId, runId }) => {
          const completed = await assessments.completeRun({ projectId, runId });
          return completed.ok
            ? ({ ok: true, value: undefined } as const)
            : ({ ok: false, error: completed.error } as const);
        },
      },
      { createRunId: () => "run-retried" },
    );
    await expect(retried.execute({ projectId: "project-retry" })).resolves.toEqual({
      status: "completed",
      runId: "run-retried",
    });
    await expect(assessments.getRun("project-retry")).resolves.toMatchObject({
      runId: "run-retried",
      status: "completed",
    });
    database.close();
  });
});
