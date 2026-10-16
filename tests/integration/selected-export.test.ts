import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { ExportSelectedNames } from "../../src/application/use-cases/ExportSelectedNames";
import { GetCandidateDetail } from "../../src/application/use-cases/GetCandidateDetail";
import { GetCandidateFunnel } from "../../src/application/use-cases/GetCandidateFunnel";
import { GetProjectWorkspace } from "../../src/application/use-cases/GetProjectWorkspace";
import { EryaDatabase } from "../../src/infrastructure/database/EryaDatabase";
import { prepareSelectedNamesJson } from "../../src/infrastructure/export/downloadJson";
import { preparePrintDocument } from "../../src/infrastructure/export/printDocument";
import { DexieAssessmentRepository } from "../../src/infrastructure/repositories/DexieAssessmentRepository";
import { DexieEvaluationRepository } from "../../src/infrastructure/repositories/DexieEvaluationRepository";
import { DexieGenerationRepository } from "../../src/infrastructure/repositories/DexieGenerationRepository";
import { DexieProjectRepository } from "../../src/infrastructure/repositories/DexieProjectRepository";
import { namingProfileFixture } from "../fixtures/namingProfile";
import { namingProjectFixture } from "../fixtures/namingProject";

const databaseNames = new Set<string>();

afterEach(async () => {
  await Promise.all([...databaseNames].map((name) => EryaDatabase.delete(name)));
  databaseNames.clear();
});

describe("ExportSelectedNames", () => {
  it.each([
    ["empty explicit selection", 0],
    ["one name", 1],
    ["five names", 5],
    ["twenty names", 20],
    ["more than twenty names", 27],
  ])("exports %s without a finalist cap", async (_label, count) => {
    const { exporter, ids, database } = await createWorkspace();
    const candidateIds = ids.slice(0, count);
    const preview = await exporter.preview({
      projectId: "p1",
      candidateIds,
      mode: "share",
    });
    const built = await exporter.build({
      projectId: "p1",
      candidateIds,
      mode: "share",
      format: "json",
    });

    expect(preview).toMatchObject({
      ok: true,
      value: { availableCount: 27, selectedCount: count },
    });
    expect(built.ok && built.value.candidates).toHaveLength(count);
    database.close();
  });

  it("defaults to every selected name and rejects ids outside the selected pool", async () => {
    const { exporter, database } = await createWorkspace();
    await database.candidates.add(candidateRecord("outside", 99));
    await database.candidateDecisions.add({
      candidateId: "outside",
      projectId: "p1",
      pool: "candidate",
      updatedAt: "2026-10-16T00:00:00.000Z",
    });

    await expect(exporter.preview({ projectId: "p1", mode: "share" })).resolves.toMatchObject({
      ok: true,
      value: { selectedCount: 27 },
    });
    await expect(
      exporter.preview({ projectId: "p1", mode: "share", candidateIds: ["outside"] }),
    ).resolves.toEqual({ ok: false, error: "candidate-not-selected" });
    database.close();
  });

  it("uses one privacy policy for print and JSON while retaining hard risks", async () => {
    const { exporter, ids, database } = await createWorkspace();
    const shareResult = await exporter.build({
      projectId: "p1",
      candidateIds: [ids[0]!],
      mode: "share",
      format: "json",
    });
    expect(shareResult.ok).toBe(true);
    if (!shareResult.ok) throw new Error(shareResult.error);

    const json = prepareSelectedNamesJson(shareResult.value);
    const printable = preparePrintDocument({ ...shareResult.value, format: "print" });
    expect(json.visibility).toEqual(printable.visibility);
    expect(JSON.stringify(json)).not.toContain("2026-02-03T08:15");
    expect(JSON.stringify(json)).not.toContain("宋家长");
    expect(JSON.stringify(json)).not.toContain("家庭私密备注");
    expect(JSON.stringify(json)).not.toContain("生肖明细");
    expect(json.privateData).toBeUndefined();
    expect(json.candidates[0]?.evaluation).toEqual({ rating: 5 });
    expect(json.candidates[0]?.hardRisks).toEqual([
      expect.objectContaining({ ruleId: "l1-family-constraint", status: "conflict" }),
    ]);
    expect(json.candidates[0]?.hardRisks[0]?.explanation).not.toContain("宋家长");
    database.close();
  });

  it("requires explicit confirmation before building a personal export", async () => {
    const { exporter, ids, database } = await createWorkspace();
    await expect(
      exporter.build({
        projectId: "p1",
        candidateIds: [ids[0]!],
        mode: "personal",
        format: "json",
      }),
    ).resolves.toEqual({ ok: false, error: "personal-export-confirmation-required" });

    const result = await exporter.build({
      projectId: "p1",
      candidateIds: [ids[0]!],
      mode: "personal",
      format: "json",
      personalDataConfirmed: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.privateData).toMatchObject({
      birth: { localDateTime: "2026-02-03T08:15" },
      relatives: { names: ["宋家长"] },
      notes: { dialect: "家庭私密备注" },
    });
    expect(result.value.privateData?.fourPillars).toHaveLength(4);
    expect(result.value.candidates[0]?.evaluation?.note).toBe("候选个人备注");
    database.close();
  });
});

async function createWorkspace() {
  const databaseName = `erya-selected-export-${crypto.randomUUID()}`;
  databaseNames.add(databaseName);
  const database = new EryaDatabase(databaseName);
  const profile = {
    ...namingProfileFixture("p1"),
    basics: {
      ...namingProfileFixture("p1").basics,
      dialectNotes: "家庭私密备注",
    },
    family: {
      ...namingProfileFixture("p1").family,
      relativeNames: ["宋家长"],
      relativeAvoidances: [
        {
          fullName: "宋家长",
          givenName: "家长",
          mode: "same-character" as const,
          pinyin: [],
        },
      ],
    },
    calendar: {
      ...namingProfileFixture("p1").calendar,
      birthLocalDateTime: "2026-02-03T08:15",
      timeKnown: true,
    },
    modules: {
      ...namingProfileFixture("p1").modules,
      zodiac: {
        ...namingProfileFixture("p1").modules.zodiac,
        detailsVisible: true,
      },
    },
  };
  await database.projects.add(namingProjectFixture("p1"));
  await database.profiles.add(profile);
  const ids = Array.from({ length: 27 }, (_, index) => `c${index + 1}`);
  await database.candidates.bulkAdd(ids.map((id, index) => candidateRecord(id, index)));
  await database.candidateDecisions.bulkAdd(
    ids.map((candidateId) => ({
      candidateId,
      projectId: "p1",
      pool: "selected" as const,
      updatedAt: "2026-10-16T00:00:00.000Z",
    })),
  );
  await database.candidateScores.bulkAdd(
    ids.map((candidateId, index) => ({
      candidateId,
      projectId: "p1",
      configRevision: 0,
      inputHash: `hash-${candidateId}`,
      hardStatus: index === 0 ? ("conflict" as const) : ("pass" as const),
      totalScore: 90 - index / 10,
      completeness: 1,
      evaluatedDimensions: 1,
      expectedDimensions: 1,
      hiddenScoredModuleCount: 0,
      moduleScores: { basic: 90 },
      topDeductions: [],
    })),
  );
  await database.ruleEvidence.bulkAdd([
    {
      id: "hard-family",
      projectId: "p1",
      candidateId: ids[0]!,
      moduleId: "basic" as const,
      dimensionId: "family",
      ruleId: "l1-family-constraint",
      ruleVersion: "2",
      severity: "hard" as const,
      status: "conflict" as const,
      applicability: "applied" as const,
      explanation: "与亲属宋家长同字",
      inputSummary: "亲属宋家长",
      inputHash: `hash-${ids[0]}`,
      calculation: ["宋家长 -> 家"],
      sourceIds: ["family-input"],
    },
    {
      id: "zodiac-detail",
      projectId: "p1",
      candidateId: ids[0]!,
      moduleId: "zodiac" as const,
      dimensionId: "zodiac",
      ruleId: "zodiac-advisory",
      ruleVersion: "1",
      schoolId: "zodiac-school",
      severity: "soft" as const,
      status: "notice" as const,
      applicability: "applied" as const,
      scoreBefore: 100,
      deduction: 1,
      scoreAfter: 99,
      explanation: "生肖明细",
      inputSummary: "生肖明细输入",
      inputHash: `hash-${ids[0]}`,
      calculation: ["100 - 1 = 99"],
      sourceIds: ["zodiac-source"],
    },
  ]);
  await database.candidateEvaluations.add({
    candidateId: ids[0]!,
    projectId: "p1",
    rating: 5,
    note: "候选个人备注",
    updatedAt: "2026-10-16T00:00:00.000Z",
  });

  const projects = new DexieProjectRepository(database);
  const generations = new DexieGenerationRepository(database);
  const assessments = new DexieAssessmentRepository(database);
  const evaluations = new DexieEvaluationRepository(database);
  const funnel = new GetCandidateFunnel(generations, assessments, evaluations, projects);
  const details = new GetCandidateDetail(funnel, assessments, projects);
  return {
    database,
    ids,
    exporter: new ExportSelectedNames(new GetProjectWorkspace(projects), funnel, details, {
      now: () => "2026-10-16T10:00:00.000Z",
    }),
  };
}

function candidateRecord(id: string, index: number) {
  const suffix = String(index).padStart(2, "0");
  return {
    id,
    projectId: "p1",
    batchId: null,
    normalizedFingerprint: `宋清${suffix}`,
    surname: "宋",
    givenName: `清${suffix}`,
    fullName: `宋清${suffix}`,
    pinyin: ["qīng", "yuǎn"],
    sourceType: "modern_combination" as const,
    summary: `候选 ${suffix}`,
    createdAt: new Date(Date.UTC(2026, 9, 16, 0, 0, index)).toISOString(),
  };
}
