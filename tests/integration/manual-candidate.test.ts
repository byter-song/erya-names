import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import devBundle from "../../src/data/curated/dev-bundle.json";
import { AddManualCandidate } from "../../src/application/use-cases/AddManualCandidate";
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

describe("AddManualCandidate", () => {
  it("validates official characters and stores an unreviewed user candidate with unknown evidence", async () => {
    const name = `erya-manual-${crypto.randomUUID()}`;
    names.add(name);
    const database = new EryaDatabase(name);
    await database.projects.add(namingProjectFixture());
    await database.profiles.add(namingProfileFixture());
    const result = await new AddManualCandidate(
      new DexieProjectRepository(database),
      new DexieManualCandidateRepository(database),
      {
        loadBundle: () => runtimeBundleSchema.parse(devBundle),
        createId: () => "manual-1",
        now: () => "2026-09-18T00:00:00.000Z",
      },
    ).execute({
      projectId: "project-song",
      fullName: "宋泽谦",
      userSource: "家人提议",
      meaning: "温润谦和",
    });

    expect(result.ok).toBe(true);
    await expect(database.candidates.get("manual-1")).resolves.toMatchObject({
      fullName: "宋泽谦",
      sourceType: "user_input",
      batchId: null,
      characterEvidence: [
        expect.objectContaining({ char: "泽", meanings: expect.any(Array) }),
        expect.objectContaining({ char: "谦", meanings: expect.any(Array) }),
      ],
    });
    const rules = await database.ruleResults.where("candidateId").equals("manual-1").toArray();
    expect(rules.some((rule) => rule.outcome === "unknown")).toBe(true);
    expect(rules.some((rule) => rule.outcome === "reject")).toBe(false);
    await expect(database.candidateDecisions.get("manual-1")).resolves.toMatchObject({
      stage: "inbox",
    });
    database.close();
  });

  it("rejects a surname mismatch, wrong length, avoid character and duplicate", async () => {
    const name = `erya-manual-${crypto.randomUUID()}`;
    names.add(name);
    const database = new EryaDatabase(name);
    await database.projects.add(namingProjectFixture());
    await database.profiles.add({ ...namingProfileFixture(), avoidCharacters: ["病"] });
    const useCase = new AddManualCandidate(
      new DexieProjectRepository(database),
      new DexieManualCandidateRepository(database),
      {
        loadBundle: () => runtimeBundleSchema.parse(devBundle),
        createId: () => crypto.randomUUID(),
        now: () => "2026-09-18T00:00:00.000Z",
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
        fullName: "宋清",
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
    const first = await useCase.execute({
      projectId: "project-song",
      fullName: "宋清扬",
      userSource: "手工",
      meaning: "测试",
    });
    expect(first.ok).toBe(true);
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

  it("runs reviewed L2 risks for a manual candidate when evidence exists", async () => {
    const name = `erya-manual-${crypto.randomUUID()}`;
    names.add(name);
    const database = new EryaDatabase(name);
    await database.projects.add(namingProjectFixture());
    await database.profiles.add(namingProfileFixture());
    const result = await new AddManualCandidate(
      new DexieProjectRepository(database),
      new DexieManualCandidateRepository(database),
      {
        loadBundle: () => runtimeBundleSchema.parse(devBundle),
        createId: () => "manual-risk",
        now: () => "2026-09-18T00:00:00.000Z",
      },
    ).execute({
      projectId: "project-song",
      fullName: "宋景行",
      userSource: "家人提议",
      meaning: "景行行止",
    });

    expect(result.ok).toBe(true);
    const rules = await database.ruleResults
      .where("candidateId")
      .equals("manual-risk")
      .toArray();
    expect(rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evidenceLevel: "L2",
          outcome: "warn",
          ruleId: "l2-multiple-pronunciation",
        }),
      ]),
    );
    database.close();
  });

  it("rejects blank source and meaning at the application boundary", async () => {
    const name = `erya-manual-${crypto.randomUUID()}`;
    names.add(name);
    const database = new EryaDatabase(name);
    await database.projects.add(namingProjectFixture());
    await database.profiles.add(namingProfileFixture());
    const useCase = new AddManualCandidate(
      new DexieProjectRepository(database),
      new DexieManualCandidateRepository(database),
      {
        loadBundle: () => runtimeBundleSchema.parse(devBundle),
        createId: () => "manual-empty",
        now: () => "2026-09-18T00:00:00.000Z",
      },
    );
    await expect(
      useCase.execute({
        projectId: "project-song",
        fullName: "宋清扬",
        userSource: "  ",
        meaning: "清朗",
      }),
    ).resolves.toEqual({ ok: false, error: "manual-source-required" });
    await expect(
      useCase.execute({
        projectId: "project-song",
        fullName: "宋清扬",
        userSource: "家人提议",
        meaning: "  ",
      }),
    ).resolves.toEqual({ ok: false, error: "manual-meaning-required" });
    database.close();
  });
});
