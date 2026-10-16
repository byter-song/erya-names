import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { AddManualCandidate } from "../../src/application/use-cases/AddManualCandidate";
import devBundle from "../../src/data/curated/dev-bundle.json";
import { runtimeBundleSchema } from "../../src/data/schema/runtimeBundle";
import { EryaDatabase } from "../../src/infrastructure/database/EryaDatabase";
import { DexieManualCandidateRepository } from "../../src/infrastructure/repositories/DexieManualCandidateRepository";
import { DexieProjectRepository } from "../../src/infrastructure/repositories/DexieProjectRepository";
import { namingProfileFixture } from "../fixtures/namingProfile";
import { namingProjectFixture } from "../fixtures/namingProject";

const names = new Set<string>();
afterEach(async () => {
  await Promise.all([...names].map((name) => EryaDatabase.delete(name)));
  names.clear();
});

function createDatabase(): EryaDatabase {
  const name = `erya-manual-${crypto.randomUUID()}`;
  names.add(name);
  return new EryaDatabase(name);
}

describe("AddManualCandidate", () => {
  it("writes only a candidate, source, and inspiration-pool decision", async () => {
    const database = createDatabase();
    await database.projects.add(namingProjectFixture());
    await database.profiles.add(namingProfileFixture());
    const result = await new AddManualCandidate(
      new DexieProjectRepository(database),
      new DexieManualCandidateRepository(database),
      {
        loadBundle: () =>
          runtimeBundleSchema.parse({
            ...devBundle,
            standardCharacterPinyin: { 泽: ["zé"], 谦: ["qiān"] },
          }),
        createId: () => "manual-1",
        now: () => "2026-10-16T00:00:00.000Z",
      },
    ).execute({
      projectId: "project-song",
      fullName: "宋泽谦",
      userSource: "家人提议",
      meaning: "温润谦和",
    });

    expect(result).toEqual({ ok: true, value: { candidateId: "manual-1" } });
    await expect(database.candidates.get("manual-1")).resolves.toMatchObject({
      fullName: "宋泽谦",
      sourceType: "user_input",
      batchId: null,
      pinyin: ["zé", "qiān"],
    });
    await expect(database.candidateSources.get("manual-1:source:1")).resolves.toMatchObject({
      sourceId: "user-input",
      location: "家人提议",
    });
    await expect(database.candidateDecisions.get("manual-1")).resolves.toMatchObject({
      pool: "inspiration",
    });
    database.close();
  });

  it("enforces the current nested profile constraints and duplicate fingerprint", async () => {
    const database = createDatabase();
    await database.projects.add(namingProjectFixture());
    await database.profiles.add({
      ...namingProfileFixture(),
      family: { ...namingProfileFixture().family, avoidCharacters: ["病"] },
    });
    const useCase = new AddManualCandidate(
      new DexieProjectRepository(database),
      new DexieManualCandidateRepository(database),
      {
        loadBundle: () => runtimeBundleSchema.parse(devBundle),
        createId: () => crypto.randomUUID(),
        now: () => "2026-10-16T00:00:00.000Z",
      },
    );

    await expect(
      useCase.execute({
        projectId: "project-song",
        fullName: "李清扬",
        userSource: "手工",
        meaning: "测试",
      }),
    ).resolves.toMatchObject({ ok: false });
    await expect(
      useCase.execute({
        projectId: "project-song",
        fullName: "宋安病",
        userSource: "手工",
        meaning: "测试",
      }),
    ).resolves.toMatchObject({ ok: false });
    expect(
      await useCase.execute({
        projectId: "project-song",
        fullName: "宋清扬",
        userSource: "手工",
        meaning: "测试",
      }),
    ).toMatchObject({ ok: true });
    await expect(
      useCase.execute({
        projectId: "project-song",
        fullName: "宋清扬",
        userSource: "手工",
        meaning: "测试",
      }),
    ).resolves.toEqual({
      ok: false,
      error: "这个名字已经在本方案中，请在灵感池或候选集中搜索后保留。",
    });
    database.close();
  });

  it("rejects blank provenance or meaning before persistence", async () => {
    const database = createDatabase();
    await database.projects.add(namingProjectFixture());
    await database.profiles.add(namingProfileFixture());
    const useCase = new AddManualCandidate(
      new DexieProjectRepository(database),
      new DexieManualCandidateRepository(database),
      {
        loadBundle: () => runtimeBundleSchema.parse(devBundle),
        createId: () => "manual-empty",
        now: () => "2026-10-16T00:00:00.000Z",
      },
    );
    await expect(
      useCase.execute({
        projectId: "project-song",
        fullName: "宋清扬",
        userSource: " ",
        meaning: "清朗",
      }),
    ).resolves.toEqual({ ok: false, error: "manual-source-required" });
    await expect(
      useCase.execute({
        projectId: "project-song",
        fullName: "宋清扬",
        userSource: "家人提议",
        meaning: " ",
      }),
    ).resolves.toEqual({ ok: false, error: "manual-meaning-required" });
    database.close();
  });
});
