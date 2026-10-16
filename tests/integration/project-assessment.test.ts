import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { canonicalStringify } from "../../src/application/backup/checksum";
import type { NamingProfile } from "../../src/domain/project/profile";
import { EryaDatabase } from "../../src/infrastructure/database/EryaDatabase";
import { createApplicationContainer } from "../../src/infrastructure/container";

const databases: EryaDatabase[] = [];

afterEach(async () => {
  vi.unstubAllGlobals();
  for (const database of databases) {
    database.close();
    await EryaDatabase.delete(database.name);
  }
  databases.length = 0;
});

describe("project folklore assessment", () => {
  it("reuses identical input, invalidates changed conventions and preserves uncertainty/conflict", async () => {
    vi.stubGlobal("__APP_VERSION__", "0.3.0");
    const database = new EryaDatabase(`project-assessment-${crypto.randomUUID()}`);
    databases.push(database);
    let sequence = 0;
    const app = createApplicationContainer({
      database,
      createId: () => `id-${++sequence}`,
      now: () => `2026-10-16T00:00:0${sequence}.000Z`,
    });
    const created = await app.createNamingProject!.execute({
      title: "项目民俗分析",
      surname: "宋",
      surnameType: "single",
      givenNameLength: 2,
      completeOnboarding: true,
      profile: { family: { constraintKnowledge: "none" } },
    });
    if (!created.ok) throw new Error(created.error);
    const projectId = created.value.projectId;

    const firstRun = await configure(app, projectId, {
      birthLocalDateTime: "2024-02-04T16:30",
      timeKnown: true,
      dayBoundary: "midnight",
    });
    const first = await app.assessNamingProject!.execute({ projectId, runId: firstRun });
    if (!first.ok) throw new Error(first.error);
    expect(first.value.reused).toBe(false);
    const firstBytes = canonicalStringify(first.value.assessments);

    const repeated = await app.assessNamingProject!.execute({ projectId, runId: firstRun });
    if (!repeated.ok) throw new Error(repeated.error);
    expect(repeated.value.reused).toBe(true);
    expect(canonicalStringify(repeated.value.assessments)).toBe(firstBytes);

    const workspace = await app.getProjectWorkspace!.execute(projectId);
    if (!workspace.ok) throw new Error(workspace.error);
    const displayOnly = await app.updateNamingProfile!.execute({
      projectId,
      expectedRevision: workspace.value.profile.configRevision,
      patch: {
        modules: {
          ...workspace.value.profile.modules,
          bazi_wuxing: {
            ...workspace.value.profile.modules.bazi_wuxing,
            detailsVisible: false,
          },
        },
      },
      completeOnboarding: false,
    });
    if (!displayOnly.ok) throw new Error(displayOnly.error);
    expect(displayOnly.value.runId).toBeUndefined();
    const afterDisplayChange = await app.assessNamingProject!.execute({
      projectId,
      runId: firstRun,
    });
    expect(afterDisplayChange.ok && afterDisplayChange.value.reused).toBe(true);

    const conventionRun = await configure(app, projectId, { dayBoundary: "zi" });
    const conventionChanged = await app.assessNamingProject!.execute({
      projectId,
      runId: conventionRun,
    });
    if (!conventionChanged.ok) throw new Error(conventionChanged.error);
    expect(conventionChanged.value.assessments[0]?.inputHash).not.toBe(
      first.value.assessments[0]?.inputHash,
    );

    const missingTimeRun = await configure(app, projectId, {
      birthLocalDateTime: "2024-08-08",
      timeKnown: false,
      dayBoundary: "midnight",
    });
    const missingTime = await app.assessNamingProject!.execute({
      projectId,
      runId: missingTimeRun,
    });
    if (!missingTime.ok) throw new Error(missingTime.error);
    const missingResult = missingTime.value.assessments[0]?.result as unknown as {
      calendar: { pillars: string[] };
      usefulGod: { scoringApplicability: string; consensus: { status: string } };
    };
    expect(missingResult.calendar.pillars).toHaveLength(3);
    expect(missingResult.usefulGod.scoringApplicability).toBe("missing_input");
    expect(missingResult.usefulGod.consensus.status).toBe("insufficient_input");

    const conflictRun = await configure(app, projectId, {
      birthLocalDateTime: "2024-01-01T06:30",
      timeKnown: true,
    });
    const conflict = await app.assessNamingProject!.execute({
      projectId,
      runId: conflictRun,
    });
    if (!conflict.ok) throw new Error(conflict.error);
    const conflictResult = conflict.value.assessments[0]?.result as unknown as {
      usefulGod: { consensus: { status: string } };
    };
    expect(conflictResult.usefulGod.consensus.status).toBe("conflict");
  });
});

async function configure(
  app: ReturnType<typeof createApplicationContainer>,
  projectId: string,
  calendarPatch: Partial<NamingProfile["calendar"]>,
) {
  const workspace = await app.getProjectWorkspace!.execute(projectId);
  if (!workspace.ok) throw new Error(workspace.error);
  const updated = await app.updateNamingProfile!.execute({
    projectId,
    expectedRevision: workspace.value.profile.configRevision,
    patch: {
      calendar: { ...workspace.value.profile.calendar, ...calendarPatch },
      modules: {
        ...workspace.value.profile.modules,
        bazi_wuxing: {
          analysisEnabled: true,
          detailsVisible: true,
          weight: 20,
          schoolId: "four-path-useful-god-v1",
          ruleVersion: "1.0.0",
        },
      },
    },
    completeOnboarding: false,
  });
  if (!updated.ok) throw new Error(updated.error);
  if (!updated.value.runId) throw new Error("assessment run missing");
  return updated.value.runId;
}
