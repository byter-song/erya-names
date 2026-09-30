import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { CreateNamingProject } from "../../src/application/use-cases/CreateNamingProject";
import { DeleteNamingProject } from "../../src/application/use-cases/DeleteNamingProject";
import { GetProjectWorkspace } from "../../src/application/use-cases/GetProjectWorkspace";
import { UpdateNamingProfile } from "../../src/application/use-cases/UpdateNamingProfile";
import { EryaDatabase } from "../../src/infrastructure/database/EryaDatabase";
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
  it("creates and reloads a Song surname project through one repository", async () => {
    const database = createDatabase();
    const repository = new DexieProjectRepository(database);
    const createProject = new CreateNamingProject(repository, {
      createId: () => "project-song",
      now: () => "2026-09-17T00:00:00.000Z",
    });

    const created = await createProject.execute({
      title: "宋姓宝宝起名",
      surname: "宋",
      surnameType: "single",
      givenNameLength: 2,
    });

    expect(created.ok).toBe(true);
    database.close();

    const reopened = createDatabaseWithName(database.name);
    const workspace = await new GetProjectWorkspace(
      new DexieProjectRepository(reopened),
    ).execute("project-song");

    expect(workspace.ok && workspace.value.project.title).toBe("宋姓宝宝起名");
    expect(workspace.ok && workspace.value.profile.surname).toBe("宋");
    reopened.close();
  });

  it("updates the profile and advances the project to generation", async () => {
    const database = createDatabase();
    const repository = new DexieProjectRepository(database);
    const createProject = new CreateNamingProject(repository, {
      createId: () => "project-song",
      now: () => "2026-09-17T00:00:00.000Z",
    });
    await createProject.execute({
      title: "宋姓宝宝起名",
      surname: "宋",
      surnameType: "single",
      givenNameLength: 2,
    });

    const updated = await new UpdateNamingProfile(repository, {
      now: () => "2026-09-17T01:00:00.000Z",
    }).execute({
      projectId: "project-song",
      patch: {
        avoidCharacters: ["病"],
        styleTags: ["清朗自然"],
      },
      completeOnboarding: true,
    });

    expect(updated.ok).toBe(true);
    const workspace = await new GetProjectWorkspace(repository).execute("project-song");
    expect(workspace.ok && workspace.value.project.stage).toBe("generation");
    expect(workspace.ok && workspace.value.profile.avoidCharacters).toEqual(["病"]);
    database.close();
  });

  it("deletes the project and all project-owned records without touching another project", async () => {
    const database = createDatabase();
    const repository = new DexieProjectRepository(database);
    await database.projects.bulkAdd([
      {
        id: "project-song",
        title: "宋姓宝宝起名",
        stage: "generation",
        status: "active",
        createdAt: "2026-09-17T00:00:00.000Z",
        updatedAt: "2026-09-17T00:00:00.000Z",
      },
      {
        id: "project-li",
        title: "李姓宝宝起名",
        stage: "generation",
        status: "active",
        createdAt: "2026-09-17T00:00:00.000Z",
        updatedAt: "2026-09-17T00:00:00.000Z",
      },
    ]);
    await database.profiles.bulkAdd([
      profileFixture("project-song", "宋"),
      profileFixture("project-li", "李"),
    ]);
    await database.candidates.add({
      id: "candidate-song",
      projectId: "project-song",
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
    await database.candidateSources.add({
      id: "source-song",
      projectId: "project-song",
      candidateId: "candidate-song",
      sourceId: "manual",
    });
    await database.ruleResults.add({
      id: "rule-song",
      projectId: "project-song",
      candidateId: "candidate-song",
      evidenceLevel: "L1",
      outcome: "pass",
      ruleId: "manual",
      ruleVersion: "1",
      explanation: "通过",
      sourceRefs: [],
    });
    await database.candidateDecisions.add({
      candidateId: "candidate-song",
      projectId: "project-song",
      stage: "favorite",
      updatedAt: "2026-09-17T01:00:00.000Z",
    });
    await database.candidateEvaluations.add({
      candidateId: "candidate-song",
      projectId: "project-song",
      rating: 5,
      updatedAt: "2026-09-17T01:00:00.000Z",
    });

    const deleted = await new DeleteNamingProject(repository).execute("project-song");

    expect(deleted.ok).toBe(true);
    await expect(database.projects.get("project-song")).resolves.toBeUndefined();
    await expect(database.profiles.get("project-song")).resolves.toBeUndefined();
    await expect(database.candidates.get("candidate-song")).resolves.toBeUndefined();
    await expect(database.candidateSources.get("source-song")).resolves.toBeUndefined();
    await expect(database.ruleResults.get("rule-song")).resolves.toBeUndefined();
    await expect(database.candidateDecisions.get("candidate-song")).resolves.toBeUndefined();
    await expect(database.candidateEvaluations.get("candidate-song")).resolves.toBeUndefined();
    await expect(database.projects.get("project-li")).resolves.toBeDefined();
    await expect(database.profiles.get("project-li")).resolves.toBeDefined();
    database.close();
  });
});

function createDatabaseWithName(name: string): EryaDatabase {
  return new EryaDatabase(name);
}

function profileFixture(projectId: string, surname: string) {
  return {
    projectId,
    surname,
    surnameType: "single" as const,
    givenNameLength: 2 as const,
    requiredCharacters: [],
    generationCharacters: [],
    avoidCharacters: [],
    relativeNames: [],
    forbiddenCombinations: [],
    genderExpression: "unrestricted" as const,
    styleTags: [],
    writingComplexity: "balanced" as const,
    pinyinFriendly: false,
    folklore: { enabled: false, usefulElements: [], includeInRanking: false },
  };
}
