import { afterEach, describe, expect, it, vi } from "vitest";
import { EryaDatabase } from "../../src/infrastructure/database/EryaDatabase";
import { createApplicationContainer } from "../../src/infrastructure/container";
const databases: EryaDatabase[] = [];
afterEach(async () => {
  for (const db of databases) {
    db.close();
    await EryaDatabase.delete(db.name);
  }
  databases.length = 0;
});
async function setup() {
  vi.stubGlobal("__APP_VERSION__", "0.3.0");
  const db = new EryaDatabase(`scroll-${crypto.randomUUID()}`);
  databases.push(db);
  const app = createApplicationContainer({ database: db });
  const created = await app.createNamingProject!.execute({
    title: "长卷验收",
    surname: "宋",
    surnameType: "single",
    givenNameLength: 2,
    completeOnboarding: true,
    profile: {
      constraintKnowledge: "none",
      inspirationSources: ["historical"],
      relativeAvoidances: [
        { fullName: "李建国", givenName: "建国", mode: "same-sound", pinyin: ["jian", "guo"] },
      ],
      folklore: {
        enabled: true,
        usefulElements: [],
        includeInRanking: false,
        birthLocalDateTime: "2026-05-12T10:00",
        zodiacRules: [
          {
            zodiac: "马",
            position: "start",
            characters: "清",
            explanation: "家人提醒",
            source: "口述",
          },
        ],
      },
    },
  });
  if (!created.ok) throw new Error(created.error);
  const projectId = created.value.projectId;
  const added = await app.addManualCandidate!.execute({
    projectId,
    fullName: "宋清扬",
    meaning: "清朗",
    userSource: "家庭灵感",
  });
  if (!added.ok) throw new Error(added.error);
  return { db, app, projectId, candidateId: added.value.candidateId };
}
describe("current eligibility and durable decision", () => {
  it.each(["character", "relative-sound"])(
    "rechecks updated %s constraints transactionally and lets an invalid finalist move back",
    async (kind) => {
      const { db, app, projectId, candidateId } = await setup();
      expect(
        (await app.moveCandidateDecision!.execute({ projectId, candidateId, to: "comparison" }))
          .ok,
      ).toBe(true);
      expect(
        (await app.moveCandidateDecision!.execute({ projectId, candidateId, to: "finalist" }))
          .ok,
      ).toBe(true);
      await app.updateNamingProfile!.execute({
        projectId,
        patch:
          kind === "character"
            ? { avoidCharacters: ["清"] }
            : {
                relativeAvoidances: [
                  {
                    fullName: "林庆和",
                    givenName: "庆和",
                    mode: "same-sound",
                    pinyin: ["qing", "he"],
                  },
                ],
              },
        completeOnboarding: false,
      });
      expect((await app.getCandidateFunnel!.execute(projectId))[0]?.eligibilityIssue).toContain(
        kind === "character" ? "避字" : "同音",
      );
      expect(
        (
          await app.finalizeNamingDecision!.execute({
            projectId,
            selectedCandidateId: candidateId,
            rationale: "选择",
          })
        ).ok,
      ).toBe(false);
      expect((await app.buildFinalReport!.execute(projectId)).ok).toBe(false);
      expect(
        (await app.moveCandidateDecision!.execute({ projectId, candidateId, to: "comparison" }))
          .ok,
      ).toBe(true);
      expect(
        (await app.moveCandidateDecision!.execute({ projectId, candidateId, to: "finalist" }))
          .ok,
      ).toBe(false);
      expect(await db.finalDecisions.count()).toBe(0);
    },
  );
  it("saves a single preferred finalist, notes and advisory settings through backup import-copy", async () => {
    const { app, projectId, candidateId } = await setup();
    await app.moveCandidateDecision!.execute({ projectId, candidateId, to: "comparison" });
    await app.moveCandidateDecision!.execute({ projectId, candidateId, to: "finalist" });
    await app.recordCandidateEvaluation!.execute({
      projectId,
      candidateId,
      rating: 5,
      note: "日常叫名顺口",
    });
    expect(
      (
        await app.finalizeNamingDecision!.execute({
          projectId,
          selectedCandidateId: candidateId,
          rationale: "保留清朗的意象",
        })
      ).ok,
    ).toBe(true);
    const backup = await app.exportProjectBackup!.execute(projectId);
    if (!backup.ok) throw new Error(backup.error);
    const restored = await app.importProjectBackup!.execute({
      envelope: backup.value,
      conflictStrategy: "import-copy",
    });
    if (!restored.ok) throw new Error(restored.error);
    const newId = restored.value.projectId;
    expect(newId).not.toBe(projectId);
    const report = await app.buildFinalReport!.execute(newId);
    if (!report.ok) throw new Error(report.error);
    expect(report.value.rationale).toBe("保留清朗的意象");
    expect(report.value.finalists[0]?.note).toBe("日常叫名顺口");
    expect(report.value.profile?.folklore.zodiacRules?.[0]?.characters).toBe("清");
    expect(report.value.profile?.inspirationSources).toEqual(["historical"]);
    expect(report.value.profile?.relativeAvoidances?.[0]?.pinyin).toEqual(["jian", "guo"]);
  });
});
