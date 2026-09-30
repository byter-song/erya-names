import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { RecordCandidateEvaluation } from "../../src/application/use-cases/RecordCandidateEvaluation";
import { EryaDatabase } from "../../src/infrastructure/database/EryaDatabase";
import { DexieEvaluationRepository } from "../../src/infrastructure/repositories/DexieEvaluationRepository";

const databaseNames = new Set<string>();

afterEach(async () => {
  await Promise.all([...databaseNames].map((name) => EryaDatabase.delete(name)));
  databaseNames.clear();
});

describe("single-user candidate evaluation", () => {
  it("persists one rating and note per candidate", async () => {
    const name = `erya-evaluation-${crypto.randomUUID()}`;
    databaseNames.add(name);
    const database = new EryaDatabase(name);
    await database.candidates.add(candidateFixture());
    const useCase = new RecordCandidateEvaluation(new DexieEvaluationRepository(database), {
      now: () => "2026-09-17T02:00:00.000Z",
    });

    const saved = await useCase.execute({
      projectId: "project-song",
      candidateId: "candidate-song-qingyang",
      rating: 5,
      note: "读音清朗，出处可信",
    });

    expect(saved.ok).toBe(true);
    await expect(
      database.candidateEvaluations.get("candidate-song-qingyang"),
    ).resolves.toMatchObject({
      rating: 5,
      note: "读音清朗，出处可信",
    });
    database.close();
  });

  it("rejects ratings outside one to five", async () => {
    const name = `erya-evaluation-${crypto.randomUUID()}`;
    databaseNames.add(name);
    const database = new EryaDatabase(name);
    const result = await new RecordCandidateEvaluation(
      new DexieEvaluationRepository(database),
      {
        now: () => "2026-09-17T02:00:00.000Z",
      },
    ).execute({
      projectId: "project-song",
      candidateId: "candidate-song-qingyang",
      rating: 6,
      note: "invalid",
    });

    expect(result).toEqual({ ok: false, error: "评分必须在 1 到 5 之间" });
    database.close();
  });

  it("rejects a candidate that does not belong to the project", async () => {
    const name = `erya-evaluation-${crypto.randomUUID()}`;
    databaseNames.add(name);
    const database = new EryaDatabase(name);
    await database.candidates.add({
      id: "candidate-other",
      projectId: "project-other",
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
    const result = await new RecordCandidateEvaluation(
      new DexieEvaluationRepository(database),
      {
        now: () => "2026-09-17T02:00:00.000Z",
      },
    ).execute({ projectId: "project-song", candidateId: "candidate-other", rating: 5 });
    expect(result).toEqual({ ok: false, error: "candidate-not-found" });
    database.close();
  });
});

function candidateFixture() {
  return {
    id: "candidate-song-qingyang",
    projectId: "project-song",
    batchId: null,
    normalizedFingerprint: "宋清扬",
    surname: "宋",
    givenName: "清扬",
    fullName: "宋清扬",
    pinyin: [],
    sourceType: "user_input" as const,
    summary: "",
    sourceIds: [],
    sourceEvidence: [],
    warnings: [],
    riskSignals: [],
    ruleResults: [],
    styleTags: [],
    characterElements: [],
    createdAt: "2026-09-17T00:00:00.000Z",
  };
}
