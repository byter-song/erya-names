import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { SaveNamingConfiguration } from "../../src/application/use-cases/SaveNamingConfiguration";
import type { NamingProfile, NamingProfileDraft } from "../../src/domain/project/profile";
import { EryaDatabase } from "../../src/infrastructure/database/EryaDatabase";
import { DexieGenerationRepository } from "../../src/infrastructure/repositories/DexieGenerationRepository";
import { DexieProjectRepository } from "../../src/infrastructure/repositories/DexieProjectRepository";
import { namingProfileFixture } from "../fixtures/namingProfile";

const databaseNames = new Set<string>();
const projectId = "project-save-configuration";
const createdAt = "2026-10-16T06:00:00.000Z";

function createDatabase(): EryaDatabase {
  const name = `erya-save-configuration-${crypto.randomUUID()}`;
  databaseNames.add(name);
  return new EryaDatabase(name);
}

afterEach(async () => {
  await Promise.all([...databaseNames].map((name) => EryaDatabase.delete(name)));
  databaseNames.clear();
});

describe("SaveNamingConfiguration", () => {
  it("rejects a stale expectedRevision without overwriting the current configuration", async () => {
    const database = createDatabase();
    const save = await createUseCase(database, 2);
    const initial = namingProfileFixture(projectId);
    const firstConfiguration = draftOf({
      ...initial,
      basics: { ...initial.basics, styleTags: ["清朗自然"] },
    });

    const first = await save.execute({
      projectId,
      expectedRevision: 0,
      configuration: firstConfiguration,
    });
    expect(first.ok && first.value.profile.configRevision).toBe(1);

    const stale = await save.execute({
      projectId,
      expectedRevision: 0,
      configuration: draftOf({
        ...initial,
        basics: { ...initial.basics, styleTags: ["不应覆盖"] },
      }),
    });

    expect(stale).toEqual({ ok: false, error: "configuration-stale" });
    expect((await database.profiles.get(projectId))?.basics.styleTags).toEqual(["清朗自然"]);
    expect(await database.assessmentRuns.get(projectId)).toMatchObject({
      runId: "run-1",
      configRevision: 1,
    });
    database.close();
  });

  it("saves a detailsVisible-only change without advancing revision or creating a run", async () => {
    const database = createDatabase();
    const save = await createUseCase(database, 2);
    const initial = namingProfileFixture(projectId);
    const configuration = draftOf({
      ...initial,
      modules: {
        ...initial.modules,
        zodiac: { ...initial.modules.zodiac, detailsVisible: true },
      },
    });

    const result = await save.execute({
      projectId,
      expectedRevision: 0,
      configuration,
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        profile: { configRevision: 0, modules: { zodiac: { detailsVisible: true } } },
        impact: {
          changedSections: ["zodiac"],
          recalculationRequired: false,
          affectedCandidateCount: 0,
        },
      },
    });
    expect(result.ok && result.value.runId).toBeUndefined();
    expect((await database.profiles.get(projectId))?.configRevision).toBe(0);
    expect(await database.assessmentRuns.count()).toBe(0);
    database.close();
  });

  it("atomically advances revision and installs a revision-bound run for scoring changes", async () => {
    const database = createDatabase();
    const save = await createUseCase(database, 2);
    const initial = namingProfileFixture(projectId);

    const result = await save.execute({
      projectId,
      expectedRevision: 0,
      configuration: draftOf({
        ...initial,
        basics: { ...initial.basics, styleTags: ["清朗自然"] },
      }),
    });
    const [storedProfile, storedRun] = await Promise.all([
      database.profiles.get(projectId),
      database.assessmentRuns.get(projectId),
    ]);

    expect(result).toMatchObject({
      ok: true,
      value: {
        profile: { projectId, configRevision: 1 },
        runId: "run-1",
        impact: {
          changedSections: ["basics"],
          recalculationRequired: true,
          affectedCandidateCount: 2,
          missingInputs: [],
        },
      },
    });
    expect(storedProfile).toMatchObject({ projectId, configRevision: 1 });
    expect(storedRun).toEqual({
      projectId,
      runId: "run-1",
      configRevision: 1,
      status: "running",
      completed: 0,
      total: 2,
    });
    database.close();
  });

  it("previews changed sections, recalculation scope and missing enabled-module inputs", async () => {
    const database = createDatabase();
    const save = await createUseCase(database, 2);
    const initial = namingProfileFixture(projectId);

    const preview = await save.preview({
      projectId,
      expectedRevision: 0,
      configuration: draftOf({
        ...initial,
        modules: {
          ...initial.modules,
          bazi_wuxing: {
            ...initial.modules.bazi_wuxing,
            analysisEnabled: true,
            detailsVisible: true,
            weight: 20,
          },
        },
      }),
    });

    expect(preview).toEqual({
      ok: true,
      value: {
        changedSections: ["bazi_wuxing"],
        recalculationRequired: true,
        affectedCandidateCount: 2,
        missingInputs: ["calendar.birthLocalDateTime"],
      },
    });
    expect((await database.profiles.get(projectId))?.configRevision).toBe(0);
    expect(await database.assessmentRuns.count()).toBe(0);
    database.close();
  });
});

async function createUseCase(database: EryaDatabase, candidateCount: number) {
  const projects = new DexieProjectRepository(database);
  const generations = new DexieGenerationRepository(database);
  const created = await projects.create({
    project: {
      id: projectId,
      title: "宋姓配置保存方案",
      stage: "naming",
      status: "active",
      createdAt,
      updatedAt: createdAt,
    },
    profile: namingProfileFixture(projectId),
  });
  if (!created.ok) throw new Error(created.error);

  const candidates = Array.from({ length: candidateCount }, (_, index) => ({
    id: `candidate-${index + 1}`,
    projectId,
    batchId: null,
    normalizedFingerprint: `宋测试${index + 1}`,
    surname: "宋",
    givenName: `测试${index + 1}`,
    fullName: `宋测试${index + 1}`,
    pinyin: ["sòng", "cè", "shì"],
    sourceType: "user_input" as const,
    summary: "配置保存集成测试候选",
    createdAt,
  }));
  await database.transaction(
    "rw",
    [database.candidates, database.candidateDecisions],
    async () => {
      await database.candidates.bulkAdd(candidates);
      await database.candidateDecisions.bulkAdd(
        candidates.map((candidate) => ({
          candidateId: candidate.id,
          projectId,
          pool: "inspiration" as const,
          updatedAt: createdAt,
        })),
      );
    },
  );

  let runSequence = 0;
  return new SaveNamingConfiguration(projects, generations, {
    now: () => "2026-10-16T06:05:00.000Z",
    createRunId: () => `run-${++runSequence}`,
  });
}

function draftOf(profile: NamingProfile): NamingProfileDraft {
  return {
    basics: profile.basics,
    family: profile.family,
    inspiration: profile.inspiration,
    calendar: profile.calendar,
    modules: profile.modules,
    scoring: profile.scoring,
    ...(profile.usefulGodDecision ? { usefulGodDecision: profile.usefulGodDecision } : {}),
  };
}
