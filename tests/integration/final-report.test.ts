import { namingProfileFixture } from "../fixtures/namingProfile";
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { BuildFinalReport } from "../../src/application/use-cases/BuildFinalReport";
import { EryaDatabase } from "../../src/infrastructure/database/EryaDatabase";
import { DexieReportRepository } from "../../src/infrastructure/repositories/DexieReportRepository";

const databaseNames = new Set<string>();
afterEach(async () => {
  await Promise.all([...databaseNames].map((name) => EryaDatabase.delete(name)));
  databaseNames.clear();
});

describe("BuildFinalReport", () => {
  it("builds an immutable report model from three finalists and their evidence", async () => {
    const name = `erya-report-${crypto.randomUUID()}`;
    databaseNames.add(name);
    const database = new EryaDatabase(name);
    await database.projects.add({
      id: "p1",
      title: "宋姓宝宝起名",
      status: "completed",
      updatedAt: "2026-09-17T00:00:00.000Z",
    });
    await database.profiles.add({
      ...namingProfileFixture("p1"),
      constraintKnowledge: "none",
      surname: "宋",
      avoidCharacters: ["病"],
      folklore: { enabled: false },
    });
    await database.candidates.bulkAdd(
      ["清扬", "知远", "嘉树"].map((givenName, index) => ({
        id: `c${index + 1}`,
        projectId: "p1",
        batchId: "b1",
        normalizedFingerprint: `宋${givenName}`,
        fullName: `宋${givenName}`,
        givenName,
        pinyin: [],
        summary: `${givenName}寓意`,
        sourceType: "verified_allusion",
        createdAt: "2026-09-17T00:00:00.000Z",
      })),
    );
    await database.candidateDecisions.bulkAdd(
      ["c1", "c2", "c3"].map((candidateId) => ({
        candidateId,
        projectId: "p1",
        stage: "finalist",
        updatedAt: "2026-09-17T00:00:00.000Z",
      })),
    );
    await database.candidateSources.add({
      id: "s1",
      projectId: "p1",
      candidateId: "c1",
      sourceId: "shijing",
      work: "诗经·郑风",
      quote: "有美一人，清扬婉兮。",
    });
    await database.finalDecisions.add({
      projectId: "p1",
      selectedCandidateId: "c1",
      rationale: "出处可信",
      updatedAt: "2026-09-17T01:00:00.000Z",
    });

    const result = await new BuildFinalReport(new DexieReportRepository(database)).execute(
      "p1",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.finalists).toHaveLength(3);
    expect(result.value.finalists[0]?.sources[0]).toMatchObject({
      quote: "有美一人，清扬婉兮。",
    });
    expect(result.value.selectedCandidateId).toBe("c1");
    database.close();
  });
});
