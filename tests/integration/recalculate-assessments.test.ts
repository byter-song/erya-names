import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GenerationRepository } from "../../src/application/ports/GenerationRepository";
import type { ProjectRepository } from "../../src/application/ports/ProjectRepository";
import {
  createAssessmentScheduler,
  RecalculateProjectAssessments,
} from "../../src/application/use-cases/RecalculateProjectAssessments";
import type { Candidate } from "../../src/domain/candidate/candidate";
import type { NamingProfile } from "../../src/domain/project/profile";
import type { CandidateScore } from "../../src/domain/rules/candidateScore";
import { EryaDatabase } from "../../src/infrastructure/database/EryaDatabase";
import { DexieAssessmentRepository } from "../../src/infrastructure/repositories/DexieAssessmentRepository";
import { DexieGenerationRepository } from "../../src/infrastructure/repositories/DexieGenerationRepository";
import { DexieProjectRepository } from "../../src/infrastructure/repositories/DexieProjectRepository";
import { namingProfileFixture } from "../fixtures/namingProfile";

const databaseNames = new Set<string>();
const createdAt = "2026-10-16T04:00:00.000Z";

interface ScheduledTask {
  run(): void;
}

interface CandidateAssessmentInput {
  candidate: Candidate;
  profile: NamingProfile;
}

function createDatabase(): EryaDatabase {
  const name = `erya-recalculate-${crypto.randomUUID()}`;
  databaseNames.add(name);
  return new EryaDatabase(name);
}

afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  await Promise.all([...databaseNames].map((name) => EryaDatabase.delete(name)));
  databaseNames.clear();
});

describe("RecalculateProjectAssessments", () => {
  it("recalculates 1000 candidates within the two-second orchestration budget", async () => {
    const database = createDatabase();
    const profile = profileAtRevision(1);
    await seedWorkspace(database, profile, 1_000, "run-performance");
    const useCase = createUseCase(database, {
      batchSize: 100,
      scheduler: { schedule: (task) => queueMicrotask(task) },
    });

    const startedAt = performance.now();
    const result = await useCase.recalculate({
      projectId: profile.projectId,
      runId: "run-performance",
    });
    const elapsed = performance.now() - startedAt;

    expect(result).toEqual({ ok: true, value: undefined });
    expect(elapsed).toBeLessThan(2_000);
    expect(await database.candidateScores.count()).toBe(1_000);
    expect(await database.assessmentRuns.get(profile.projectId)).toMatchObject({
      status: "completed",
      completed: 1_000,
      total: 1_000,
    });
    database.close();
  });

  it("commits progress after each scheduled batch", async () => {
    const database = createDatabase();
    const profile = profileAtRevision(1);
    await seedWorkspace(database, profile, 120, "run-progress");
    const scheduled: ScheduledTask[] = [];
    const useCase = createUseCase(database, {
      batchSize: 40,
      scheduler: { schedule: (task) => scheduled.push({ run: task }) },
    });

    const recalculation = useCase.recalculate({
      projectId: profile.projectId,
      runId: "run-progress",
    });
    await waitForScheduledTask(scheduled);

    scheduled.shift()?.run();
    await vi.waitFor(async () => {
      expect(await database.assessmentRuns.get(profile.projectId)).toMatchObject({
        status: "running",
        completed: 40,
        total: 120,
      });
    });
    await waitForScheduledTask(scheduled);

    scheduled.shift()?.run();
    await vi.waitFor(async () => {
      expect((await database.assessmentRuns.get(profile.projectId))?.completed).toBe(80);
    });
    await waitForScheduledTask(scheduled);

    scheduled.shift()?.run();
    await expect(recalculation).resolves.toEqual({ ok: true, value: undefined });
    expect(await database.assessmentRuns.get(profile.projectId)).toMatchObject({
      status: "completed",
      completed: 120,
    });
    database.close();
  });

  it("cancels between batches and resumes remaining candidates in a replacement run", async () => {
    const database = createDatabase();
    const profile = profileAtRevision(1);
    await seedWorkspace(database, profile, 160, "run-cancelled");
    const scheduled: ScheduledTask[] = [];
    const interrupted = createUseCase(database, {
      batchSize: 40,
      scheduler: { schedule: (task) => scheduled.push({ run: task }) },
    });

    const interruptedResult = interrupted.recalculate({
      projectId: profile.projectId,
      runId: "run-cancelled",
    });
    await waitForScheduledTask(scheduled);
    scheduled.shift()?.run();
    await vi.waitFor(async () => {
      expect((await database.assessmentRuns.get(profile.projectId))?.completed).toBe(40);
    });
    await waitForScheduledTask(scheduled);
    await interrupted.cancel({ projectId: profile.projectId, runId: "run-cancelled" });
    scheduled.shift()?.run();

    await expect(interruptedResult).resolves.toEqual({
      ok: false,
      error: "assessment-run-cancelled",
    });
    expect(await database.assessmentRuns.get(profile.projectId)).toMatchObject({
      status: "cancelled",
      completed: 40,
    });
    expect(await database.candidateScores.count()).toBe(40);

    await database.assessmentRuns.put({
      projectId: profile.projectId,
      runId: "run-resumed",
      configRevision: 1,
      status: "running",
      completed: 40,
      total: 160,
    });
    const resumed = createUseCase(database, {
      batchSize: 40,
      scheduler: { schedule: (task) => queueMicrotask(task) },
    });
    const resumedResult = await resumed.recalculate({
      projectId: profile.projectId,
      runId: "run-resumed",
    });

    expect(resumedResult).toEqual({ ok: true, value: undefined });
    expect(await database.candidateScores.count()).toBe(160);
    expect(await database.assessmentRuns.get(profile.projectId)).toMatchObject({
      runId: "run-resumed",
      status: "completed",
      completed: 160,
    });
    database.close();
  });

  it("does not let an old run or revision overwrite a newer result", async () => {
    const database = createDatabase();
    const firstProfile = profileAtRevision(1);
    await seedWorkspace(database, firstProfile, 80, "run-old");
    const scheduled: ScheduledTask[] = [];
    const oldUseCase = createUseCase(database, {
      batchSize: 40,
      scheduler: { schedule: (task) => scheduled.push({ run: task }) },
    });
    const oldResult = oldUseCase.recalculate({
      projectId: firstProfile.projectId,
      runId: "run-old",
    });
    await waitForScheduledTask(scheduled);

    await database.transaction("rw", [database.profiles, database.assessmentRuns], async () => {
      await database.profiles.put(profileAtRevision(2));
      await database.assessmentRuns.put({
        projectId: firstProfile.projectId,
        runId: "run-new",
        configRevision: 2,
        status: "running",
        completed: 0,
        total: 80,
      });
    });
    scheduled.shift()?.run();

    await expect(oldResult).resolves.toEqual({
      ok: false,
      error: "assessment-run-stale",
    });
    expect(await database.candidateScores.count()).toBe(0);

    const newResult = await createUseCase(database, {
      batchSize: 40,
      scheduler: { schedule: (task) => queueMicrotask(task) },
    }).recalculate({ projectId: firstProfile.projectId, runId: "run-new" });
    expect(newResult).toEqual({ ok: true, value: undefined });
    expect(await database.candidateScores.toArray()).toHaveLength(80);
    expect(
      (await database.candidateScores.toArray()).every(
        (score) => score.configRevision === 2 && score.inputHash.startsWith("revision:2:"),
      ),
    ).toBe(true);
    database.close();
  });
});

describe("createAssessmentScheduler", () => {
  it("uses requestIdleCallback when the browser provides it", async () => {
    const requestIdleCallback = vi.fn((callback: () => void) => {
      queueMicrotask(callback);
      return 7;
    });
    const setTimeoutFallback = vi.fn<(callback: () => void) => number>(() => 9);
    const scheduler = createAssessmentScheduler({
      requestIdleCallback,
      setTimeout: setTimeoutFallback,
    });
    const task = vi.fn();

    scheduler.schedule(task);
    await vi.waitFor(() => expect(task).toHaveBeenCalledOnce());

    expect(requestIdleCallback).toHaveBeenCalledOnce();
    expect(setTimeoutFallback).not.toHaveBeenCalled();
  });

  it("falls back to a timer when requestIdleCallback is unavailable", async () => {
    const setTimeoutFallback = vi.fn((callback: () => void) => {
      queueMicrotask(callback);
      return 9;
    });
    const scheduler = createAssessmentScheduler({ setTimeout: setTimeoutFallback });
    const task = vi.fn();

    scheduler.schedule(task);
    await vi.waitFor(() => expect(task).toHaveBeenCalledOnce());

    expect(setTimeoutFallback).toHaveBeenCalledOnce();
  });
});

function createUseCase(
  database: EryaDatabase,
  options: {
    batchSize: number;
    scheduler: { schedule(task: () => void): void };
  },
) {
  const projects: ProjectRepository = new DexieProjectRepository(database);
  const generations: GenerationRepository = new DexieGenerationRepository(database);
  return new RecalculateProjectAssessments(
    projects,
    generations,
    new DexieAssessmentRepository(database),
    {
      batchSize: options.batchSize,
      scheduler: options.scheduler,
      evaluateCandidate: ({ candidate, profile }: CandidateAssessmentInput) => ({
        replacements: [],
        score: passingScore(candidate, profile.configRevision),
      }),
    },
  );
}

function passingScore(candidate: Candidate, configRevision: number): CandidateScore {
  return {
    candidateId: candidate.id,
    projectId: candidate.projectId,
    configRevision,
    inputHash: `revision:${configRevision}:${candidate.id}`,
    hardStatus: "pass",
    totalScore: 100,
    completeness: 1,
    evaluatedDimensions: 1,
    expectedDimensions: 1,
    hiddenScoredModuleCount: 0,
    moduleScores: { basic: 100 },
    topDeductions: [],
  };
}

async function seedWorkspace(
  database: EryaDatabase,
  profile: NamingProfile,
  candidateCount: number,
  runId: string,
): Promise<void> {
  const projects = new DexieProjectRepository(database);
  const created = await projects.create({
    project: {
      id: profile.projectId,
      title: "宋姓重算方案",
      stage: "naming",
      status: "active",
      createdAt,
      updatedAt: createdAt,
    },
    profile,
  });
  if (!created.ok) throw new Error(created.error);

  const candidates = Array.from({ length: candidateCount }, (_, index) => ({
    id: `candidate-${index.toString().padStart(4, "0")}`,
    projectId: profile.projectId,
    batchId: null,
    normalizedFingerprint: `宋测试${index}`,
    surname: "宋",
    givenName: `测试${index}`,
    fullName: `宋测试${index}`,
    pinyin: ["song", "ce", "shi"],
    sourceType: "user_input" as const,
    summary: "重算集成测试候选",
    createdAt,
  }));
  await database.transaction(
    "rw",
    [database.candidates, database.candidateDecisions, database.assessmentRuns],
    async () => {
      await database.candidates.bulkAdd(candidates);
      await database.candidateDecisions.bulkAdd(
        candidates.map((candidate) => ({
          candidateId: candidate.id,
          projectId: profile.projectId,
          pool: "inspiration" as const,
          updatedAt: createdAt,
        })),
      );
      await database.assessmentRuns.put({
        projectId: profile.projectId,
        runId,
        configRevision: profile.configRevision,
        status: "running",
        completed: 0,
        total: candidateCount,
      });
    },
  );
}

function profileAtRevision(configRevision: number): NamingProfile {
  return { ...namingProfileFixture("project-recalculate"), configRevision };
}

async function waitForScheduledTask(tasks: ScheduledTask[]): Promise<void> {
  await vi.waitFor(() => expect(tasks.length).toBeGreaterThan(0));
}
