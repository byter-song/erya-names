import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EryaDatabase } from "../../src/infrastructure/database/EryaDatabase";
import { createApplicationContainer } from "../../src/infrastructure/container";
import type { NamingProfileDraft } from "../../src/domain/project/profile";
import { namingProfileFixture } from "../fixtures/namingProfile";

const databaseNames = new Set<string>();

beforeEach(() => vi.stubGlobal("__APP_VERSION__", "0.3.0"));

afterEach(async () => {
  await Promise.all([...databaseNames].map((name) => EryaDatabase.delete(name)));
  databaseNames.clear();
  vi.unstubAllGlobals();
});

describe("configuration save to candidate detail", () => {
  it("runs the real assessment pipeline and exposes updated evidence after saving", async () => {
    const name = `erya-config-flow-${crypto.randomUUID()}`;
    databaseNames.add(name);
    const database = new EryaDatabase(name);
    const profile = namingProfileFixture("project-song");
    await database.transaction(
      "rw",
      [
        database.projects,
        database.profiles,
        database.candidates,
        database.candidateSources,
        database.candidateDecisions,
      ],
      async () => {
        await database.projects.add({
          id: profile.projectId,
          title: "宋姓配置流程",
          stage: "naming",
          status: "active",
          createdAt: "2026-10-16T00:00:00.000Z",
          updatedAt: "2026-10-16T00:00:00.000Z",
        });
        await database.profiles.add(profile);
        await database.candidates.add({
          id: "candidate-song-qingyang",
          projectId: profile.projectId,
          batchId: null,
          normalizedFingerprint: "宋清扬",
          surname: "宋",
          givenName: "清扬",
          fullName: "宋清扬",
          pinyin: ["qīng", "yáng"],
          sourceType: "modern_combination",
          summary: "清朗昂扬",
          createdAt: "2026-10-16T00:00:00.000Z",
        });
        await database.candidateSources.add({
          id: "source-candidate-song-qingyang",
          projectId: profile.projectId,
          candidateId: "candidate-song-qingyang",
          sourceId: "erya-modern-20260927",
          title: "现代双字名组合",
        });
        await database.candidateDecisions.add({
          candidateId: "candidate-song-qingyang",
          projectId: profile.projectId,
          pool: "inspiration",
          updatedAt: "2026-10-16T00:00:00.000Z",
        });
      },
    );

    const container = createApplicationContainer({
      database,
      createId: () => "run-config-1",
      now: () => "2026-10-16T01:00:00.000Z",
    });
    const next = {
      ...profile,
      basics: { ...profile.basics, styleTags: ["清朗自然"] },
    };
    const configuration = Object.fromEntries(
      Object.entries(next).filter(([key]) => key !== "projectId" && key !== "configRevision"),
    ) as NamingProfileDraft;

    const saved = await container.saveNamingConfiguration?.execute({
      projectId: profile.projectId,
      expectedRevision: 0,
      configuration,
    });
    expect(saved).toMatchObject({ ok: true, value: { runId: "run-config-1" } });

    const completed = await waitForRun(container, profile.projectId);
    expect(completed).toMatchObject({ status: "completed", completed: 1, total: 1 });

    const detail = await container.getCandidateDetail?.execute(
      profile.projectId,
      "candidate-song-qingyang",
    );
    expect(detail?.candidate).toMatchObject({ scoringPending: false, hardStatus: "pass" });
    expect(detail?.evidence.length).toBeGreaterThanOrEqual(8);
    expect(detail?.evidence.some(({ moduleId }) => moduleId === "basic")).toBe(true);
    expect(detail?.evidence.find(({ moduleId }) => moduleId === "zodiac")).toBeUndefined();
    expect(detail?.hiddenEvidenceCount).toBeGreaterThan(0);

    if (!saved?.ok) throw new Error("configuration-save-failed");
    const shown = await container.saveNamingConfiguration?.execute({
      projectId: profile.projectId,
      expectedRevision: saved.value.profile.configRevision,
      configuration: {
        ...configuration,
        basics: { ...configuration.basics, styleTags: ["清朗自然"] },
        modules: {
          ...configuration.modules,
          zodiac: { ...configuration.modules.zodiac, detailsVisible: true },
        },
      },
    });
    expect(shown).toMatchObject({
      ok: true,
      value: { impact: { recalculationRequired: false } },
    });
    const revealed = await container.getCandidateDetail?.execute(
      profile.projectId,
      "candidate-song-qingyang",
    );
    expect(revealed?.evidence.find(({ moduleId }) => moduleId === "zodiac")).toMatchObject({
      applicability: "not_applicable",
    });
    database.close();
  });
});

async function waitForRun(
  container: ReturnType<typeof createApplicationContainer>,
  projectId: string,
) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const run = await container.getAssessmentRun?.execute(projectId);
    if (run && run.status !== "running") return run;
    await new Promise((resolve) => window.setTimeout(resolve, 5));
  }
  throw new Error("assessment-run-timeout");
}
