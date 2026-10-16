import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { CopyNamingConfiguration } from "../../src/application/use-cases/CopyNamingConfiguration";
import { CreateNamingProject } from "../../src/application/use-cases/CreateNamingProject";
import { DeleteNamingProject } from "../../src/application/use-cases/DeleteNamingProject";
import { GetProjectWorkspace } from "../../src/application/use-cases/GetProjectWorkspace";
import { ListProjectSummaries } from "../../src/application/use-cases/ListProjectSummaries";
import { RenameNamingProject } from "../../src/application/use-cases/RenameNamingProject";
import { EryaDatabase } from "../../src/infrastructure/database/EryaDatabase";
import { DexieGenerationRepository } from "../../src/infrastructure/repositories/DexieGenerationRepository";
import { DexieProjectRepository } from "../../src/infrastructure/repositories/DexieProjectRepository";

const databaseNames = new Set<string>();

function createDatabase(): EryaDatabase {
  const name = `erya-project-${crypto.randomUUID()}`;
  databaseNames.add(name);
  return new EryaDatabase(name);
}

afterEach(async () => {
  await Promise.all([...databaseNames].map((name) => EryaDatabase.delete(name)));
  databaseNames.clear();
});

describe("project application use cases", () => {
  it("creates new projects with the folklore-core preset and three runnable modules", async () => {
    const database = createDatabase();
    const repository = new DexieProjectRepository(database);
    const created = await new CreateNamingProject(repository, {
      createId: () => "project-folklore-default",
      now: () => "2026-10-16T00:00:00.000Z",
    }).execute({
      title: "宋姓 · 民俗核心",
      surname: "宋",
      surnameType: "single",
      givenNameLength: 2,
    });
    if (!created.ok) throw new Error(created.error);
    const workspace = await repository.getWorkspace(created.value.projectId);

    expect(workspace?.profile.scoring).toEqual({
      presetId: "traditional-core",
      presetVersion: "1",
      basicWeight: 40,
    });
    expect(workspace?.profile.modules).toMatchObject({
      bazi_wuxing: {
        analysisEnabled: true,
        detailsVisible: true,
        weight: 35,
        schoolId: "four-path-useful-god-v1",
        ruleVersion: "1.0.0",
      },
      zodiac: {
        analysisEnabled: true,
        detailsVisible: true,
        weight: 10,
        schoolId: "zodiac-radical-hints-v1",
        ruleVersion: "1.0.0",
      },
      traditional: {
        analysisEnabled: true,
        detailsVisible: true,
        weight: 15,
        schoolId: "zuozhuan-naming-principles-v1",
        ruleVersion: "1.0.0",
      },
    });
    database.close();
  });

  it("keeps three same-surname projects independent instead of overwriting by surname", async () => {
    const database = createDatabase();
    const repository = new DexieProjectRepository(database);
    const ids = ["project-song-a", "project-song-b", "project-song-c"];
    let index = 0;
    const createProject = new CreateNamingProject(repository, {
      createId: () => ids[index++]!,
      now: () => "2026-10-16T00:00:00.000Z",
    });

    for (const title of ["清朗版", "家族版", "民俗版"])
      expect(
        (
          await createProject.execute({
            title,
            surname: "宋",
            surnameType: "single",
            givenNameLength: 2,
          })
        ).ok,
      ).toBe(true);

    const workspaces = await Promise.all(
      ids.map((projectId) => new GetProjectWorkspace(repository).execute(projectId)),
    );
    expect(workspaces.every((workspace) => workspace.ok)).toBe(true);
    expect(
      workspaces.map((workspace) => workspace.ok && workspace.value.project.title),
    ).toEqual(["清朗版", "家族版", "民俗版"]);
    expect(
      workspaces.map((workspace) => workspace.ok && workspace.value.profile.basics.surname),
    ).toEqual(["宋", "宋", "宋"]);
    expect(await database.projects.count()).toBe(3);
    expect(await database.profiles.count()).toBe(3);
    database.close();
  });

  it("renames with an updatedAt optimistic lock without changing configuration", async () => {
    const database = createDatabase();
    const repository = new DexieProjectRepository(database);
    await seedProject(repository, "project-song", "原方案");
    const before = await repository.getWorkspace("project-song");

    const renamed = await new RenameNamingProject(repository, {
      now: () => "2026-10-16T01:00:00.000Z",
    }).execute({
      projectId: "project-song",
      title: "宋姓 · 清朗版",
      expectedUpdatedAt: "2026-10-16T00:00:00.000Z",
    });
    const stale = await new RenameNamingProject(repository, {
      now: () => "2026-10-16T02:00:00.000Z",
    }).execute({
      projectId: "project-song",
      title: "不应覆盖",
      expectedUpdatedAt: "2026-10-16T00:00:00.000Z",
    });
    const after = await repository.getWorkspace("project-song");

    expect(renamed).toEqual({ ok: true, value: undefined });
    expect(stale).toEqual({ ok: false, error: "project-stale" });
    expect(after?.project.title).toBe("宋姓 · 清朗版");
    expect(after?.project.updatedAt).toBe("2026-10-16T01:00:00.000Z");
    expect(after?.profile).toEqual(before?.profile);
    database.close();
  });

  it("copies only configuration into a fresh project and resets its revision", async () => {
    const database = createDatabase();
    const repository = new DexieProjectRepository(database);
    await seedProject(repository, "project-source", "宋姓 · 原版", {
      styleTags: ["清朗自然"],
    });
    await database.candidates.add({
      id: "candidate-source",
      projectId: "project-source",
      batchId: null,
      normalizedFingerprint: "宋清扬",
      surname: "宋",
      givenName: "清扬",
      fullName: "宋清扬",
      pinyin: ["sòng", "qīng", "yáng"],
      sourceType: "user_input",
      summary: "来源方案候选",
      createdAt: "2026-10-16T00:30:00.000Z",
    });
    await database.candidateDecisions.add({
      projectId: "project-source",
      candidateId: "candidate-source",
      pool: "selected",
      updatedAt: "2026-10-16T00:30:00.000Z",
    });
    await database.candidateEvaluations.add({
      projectId: "project-source",
      candidateId: "candidate-source",
      rating: 5,
      note: "来源方案备注",
      updatedAt: "2026-10-16T00:30:00.000Z",
    });

    const copied = await new CopyNamingConfiguration(repository, {
      createId: () => "project-copy",
      now: () => "2026-10-16T02:00:00.000Z",
    }).execute({ sourceProjectId: "project-source", title: "宋姓 · 民俗版" });
    const source = await repository.getWorkspace("project-source");
    const target = await repository.getWorkspace("project-copy");

    expect(copied).toEqual({ ok: true, value: { projectId: "project-copy" } });
    expect(target?.project).toMatchObject({
      id: "project-copy",
      title: "宋姓 · 民俗版",
      stage: "naming",
      status: "active",
    });
    expect(target?.profile).toEqual({
      ...source?.profile,
      projectId: "project-copy",
      configRevision: 0,
    });
    expect(await database.candidates.where("projectId").equals("project-copy").count()).toBe(0);
    expect(
      await database.candidateDecisions.where("projectId").equals("project-copy").count(),
    ).toBe(0);
    expect(
      await database.candidateEvaluations.where("projectId").equals("project-copy").count(),
    ).toBe(0);
    expect(await database.ruleEvidence.where("projectId").equals("project-copy").count()).toBe(
      0,
    );
    expect(
      await database.candidateScores.where("projectId").equals("project-copy").count(),
    ).toBe(0);
    expect(
      await database.decisionHistory.where("projectId").equals("project-copy").count(),
    ).toBe(0);
    expect(await database.candidates.where("projectId").equals("project-source").count()).toBe(
      1,
    );
    database.close();
  });

  it("lists same-surname versions in a stable order with independent four-pool counts", async () => {
    const database = createDatabase();
    const repository = new DexieProjectRepository(database);
    await seedProject(repository, "project-b", "宋姓 · 家族版");
    await seedProject(repository, "project-a", "宋姓 · 清朗版");
    await database.candidates.bulkAdd([
      candidateRecord("candidate-a-1", "project-a", "宋清扬"),
      candidateRecord("candidate-a-2", "project-a", "宋景行"),
      candidateRecord("candidate-b-1", "project-b", "宋怀瑾"),
    ]);
    await database.candidateDecisions.bulkAdd([
      decisionRecord("candidate-a-1", "project-a", "inspiration"),
      decisionRecord("candidate-a-2", "project-a", "excluded"),
      decisionRecord("candidate-b-1", "project-b", "selected"),
    ]);

    const summaries = await new ListProjectSummaries(
      repository,
      new DexieGenerationRepository(database),
    ).execute();

    expect(summaries.map(({ id }) => id)).toEqual(["project-a", "project-b"]);
    expect(summaries[0]).toMatchObject({
      title: "宋姓 · 清朗版",
      surname: "宋",
      poolCounts: { inspiration: 1, candidate: 0, selected: 0, excluded: 1 },
      totalCandidateCount: 2,
    });
    expect(summaries[1]).toMatchObject({
      title: "宋姓 · 家族版",
      surname: "宋",
      poolCounts: { inspiration: 0, candidate: 0, selected: 1, excluded: 0 },
      totalCandidateCount: 1,
    });
    database.close();
  });

  it("deletes all v2 project-owned records without touching another project", async () => {
    const database = createDatabase();
    const repository = new DexieProjectRepository(database);
    await seedProject(repository, "project-song", "宋姓方案");
    await seedProject(repository, "project-li", "李姓方案", undefined, "李");

    const deleted = await new DeleteNamingProject(repository).execute("project-song");

    expect(deleted.ok).toBe(true);
    await expect(database.projects.get("project-song")).resolves.toBeUndefined();
    await expect(database.profiles.get("project-song")).resolves.toBeUndefined();
    await expect(database.projects.get("project-li")).resolves.toBeDefined();
    await expect(database.profiles.get("project-li")).resolves.toBeDefined();
    database.close();
  });
});

async function seedProject(
  repository: DexieProjectRepository,
  projectId: string,
  title: string,
  basics?: { styleTags: string[] },
  surname = "宋",
) {
  const result = await new CreateNamingProject(repository, {
    createId: () => projectId,
    now: () => "2026-10-16T00:00:00.000Z",
  }).execute({
    title,
    surname,
    surnameType: "single",
    givenNameLength: 2,
    completeOnboarding: true,
    profile: basics ? { basics } : undefined,
  });
  if (!result.ok) throw new Error(result.error);
}

function candidateRecord(id: string, projectId: string, fullName: string) {
  return {
    id,
    projectId,
    batchId: null,
    normalizedFingerprint: fullName,
    surname: fullName[0]!,
    givenName: fullName.slice(1),
    fullName,
    pinyin: ["song", "test"],
    sourceType: "user_input" as const,
    summary: "测试候选",
    createdAt: "2026-10-16T00:30:00.000Z",
  };
}

function decisionRecord(
  candidateId: string,
  projectId: string,
  pool: "inspiration" | "candidate" | "selected" | "excluded",
) {
  const base = {
    candidateId,
    projectId,
    updatedAt: "2026-10-16T00:30:00.000Z",
  };
  return pool === "excluded"
    ? {
        ...base,
        pool,
        lastActivePool: "inspiration" as const,
        exclusionReason: "测试排除",
        excludedAt: "2026-10-16T00:30:00.000Z",
      }
    : { ...base, pool };
}
