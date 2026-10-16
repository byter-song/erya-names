import { describe, expect, it } from "vitest";
import { GetCandidateFunnel } from "../../../src/application/use-cases/GetCandidateFunnel";
import { GetCandidateDetail } from "../../../src/application/use-cases/GetCandidateDetail";
import type { AssessmentRepository } from "../../../src/application/ports/AssessmentRepository";
import type { EvaluationRepository } from "../../../src/application/ports/EvaluationRepository";
import type { GenerationRepository } from "../../../src/application/ports/GenerationRepository";
import type { ProjectRepository } from "../../../src/application/ports/ProjectRepository";

const createdAt = "2026-10-16T00:00:00.000Z";

describe("GetCandidateFunnel", () => {
  it("returns v2 score metadata and sorts hard conflicts after usable names", async () => {
    const generations = {
      listCandidates: async () => [record("conflict", "知远"), record("pass", "清扬")],
    } as unknown as GenerationRepository;
    const assessments = {
      listScores: async () => [score("conflict", "conflict", 99), score("pass", "pass", 82)],
    } as unknown as AssessmentRepository;
    const evaluations = {
      list: async () => [
        {
          projectId: "p1",
          candidateId: "pass",
          rating: 5,
          note: "喜欢",
          updatedAt: createdAt,
        },
      ],
    } as unknown as EvaluationRepository;
    const projects = {
      getWorkspace: async () => ({ profile: { configRevision: 4 } }),
    } as unknown as ProjectRepository;

    const items = await new GetCandidateFunnel(
      generations,
      assessments,
      evaluations,
      projects,
    ).execute("p1", ["candidate"]);

    expect(items.map(({ id }) => id)).toEqual(["pass", "conflict"]);
    expect(items[0]).toMatchObject({
      pool: "candidate",
      scoringPending: false,
      hardStatus: "pass",
      totalScore: 82,
      completeness: 1,
      hiddenScoredModuleCount: 2,
      rating: 5,
      note: "喜欢",
    });
  });

  it("marks candidates pending when the current profile revision has no score", async () => {
    const generations = {
      listCandidates: async () => [record("pending", "云舟")],
    } as unknown as GenerationRepository;
    const assessments = { listScores: async () => [] } as unknown as AssessmentRepository;
    const evaluations = { list: async () => [] } as unknown as EvaluationRepository;
    const projects = {
      getWorkspace: async () => ({ profile: { configRevision: 5 } }),
    } as unknown as ProjectRepository;

    const [item] = await new GetCandidateFunnel(
      generations,
      assessments,
      evaluations,
      projects,
    ).execute("p1");

    expect(item).toMatchObject({
      scoringPending: true,
      hardStatus: "unknown",
      completeness: 0,
      moduleScores: {},
    });
  });
});

describe("GetCandidateDetail", () => {
  it("returns only visible evidence while retaining the score metadata", async () => {
    const generations = {
      listCandidates: async () => [record("pass", "清扬")],
    } as unknown as GenerationRepository;
    const assessments = {
      listScores: async () => [score("pass", "pass", 82)],
      getScore: async () => score("pass", "pass", 82),
      listEvidence: async () => [
        evidence("basic", "basic-readable"),
        evidence("zodiac", "zodiac-hidden"),
        evidence("traditional", "traditional-visible"),
      ],
    } as unknown as AssessmentRepository;
    const evaluations = { list: async () => [] } as unknown as EvaluationRepository;
    const projects = {
      getWorkspace: async () => ({
        profile: {
          configRevision: 4,
          modules: {
            zodiac: { detailsVisible: false },
            traditional: { detailsVisible: true },
          },
        },
      }),
    } as unknown as ProjectRepository;
    const funnel = new GetCandidateFunnel(generations, assessments, evaluations, projects);

    const detail = await new GetCandidateDetail(funnel, assessments, projects).execute(
      "p1",
      "pass",
    );

    expect(detail?.candidate).toMatchObject({
      totalScore: 82,
      completeness: 1,
      hardStatus: "pass",
      hiddenScoredModuleCount: 2,
    });
    expect(detail?.evidence.map(({ ruleId }) => ruleId)).toEqual([
      "basic-readable",
      "traditional-visible",
    ]);
    expect(detail?.hiddenEvidenceCount).toBe(1);
  });
});

function record(id: string, givenName: string) {
  return {
    candidate: {
      id,
      projectId: "p1",
      batchId: "batch-1",
      normalizedFingerprint: `宋${givenName}`,
      surname: "宋",
      givenName,
      fullName: `宋${givenName}`,
      pinyin: [],
      sourceType: "modern_combination" as const,
      summary: "清朗",
      createdAt,
    },
    decision: {
      candidateId: id,
      projectId: "p1",
      pool: "candidate" as const,
      updatedAt: createdAt,
    },
    sources: [{ sourceId: "modern-v1" }],
  };
}

function score(candidateId: string, hardStatus: "pass" | "conflict", totalScore: number) {
  return {
    candidateId,
    projectId: "p1",
    configRevision: 4,
    inputHash: `${candidateId}-hash`,
    hardStatus,
    totalScore,
    completeness: 1,
    evaluatedDimensions: 3,
    expectedDimensions: 3,
    hiddenScoredModuleCount: 2,
    moduleScores: { basic: totalScore },
    topDeductions: [],
  };
}

function evidence(moduleId: "basic" | "zodiac" | "traditional", ruleId: string) {
  return {
    id: `${moduleId}-${ruleId}`,
    projectId: "p1",
    candidateId: "pass",
    moduleId,
    dimensionId: ruleId,
    ruleId,
    ruleVersion: "v1",
    severity: "soft" as const,
    status: "pass" as const,
    applicability: "applied" as const,
    scoreBefore: 100,
    deduction: 0,
    scoreAfter: 100,
    explanation: "说明",
    inputSummary: "输入",
    inputHash: "pass-hash",
    calculation: ["100 - 0 = 100"],
    sourceIds: ["source-v1"],
  };
}
