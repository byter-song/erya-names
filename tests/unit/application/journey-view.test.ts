import { describe, expect, it } from "vitest";
import type { CandidatePool } from "../../../src/domain/candidate/decision";
import { GetProjectJourneyView } from "../../../src/application/use-cases/GetProjectJourneyView";
import type { GenerationRepository } from "../../../src/application/ports/GenerationRepository";
import type { ProjectRepository } from "../../../src/application/ports/ProjectRepository";
import { namingProfileFixture } from "../../fixtures/namingProfile";

function createUseCase(
  pools: CandidatePool[],
  exists = true,
  profile = namingProfileFixture("p1"),
) {
  const projects = {
    getWorkspace: async () => (exists ? { project: {}, profile } : undefined),
  } as unknown as ProjectRepository;
  const generations = {
    countBatches: async () => (pools.length ? 1 : 0),
    listCandidates: async () =>
      pools.map((pool, index) => ({
        decision: { pool, candidateId: `c${index}`, projectId: "p1" },
      })),
  } as unknown as GenerationRepository;
  return new GetProjectJourneyView(projects, generations);
}

describe("GetProjectJourneyView", () => {
  it("derives the long-scroll journey from the four persisted pools", async () => {
    await expect(createUseCase(["inspiration", "candidate"]).execute("p1")).resolves.toEqual({
      configuration: "completed",
      inspiration: "completed",
      candidate: "completed",
      selected: "available",
      export: "blocked",
    });
  });

  it("opens unlimited export as soon as the selected pool is non-empty", async () => {
    const view = await createUseCase(["selected", "selected"]).execute("p1");
    expect(view.selected).toBe("completed");
    expect(view.export).toBe("available");
  });

  it("keeps folklore-core configuration available until required inputs are complete", async () => {
    const profile = namingProfileFixture("p1");
    profile.modules.bazi_wuxing = {
      analysisEnabled: true,
      detailsVisible: true,
      weight: 35,
      schoolId: "four-path-useful-god-v1",
      ruleVersion: "1.0.0",
    };

    const missingBirth = await createUseCase([], true, profile).execute("p1");
    expect(missingBirth.configuration).toBe("available");
    expect(missingBirth.inspiration).toBe("available");

    profile.calendar.birthLocalDateTime = "2024-02-04";
    const ready = await createUseCase([], true, profile).execute("p1");
    expect(ready.configuration).toBe("completed");
  });

  it("blocks every journey stage for a missing project", async () => {
    expect(new Set(Object.values(await createUseCase([], false).execute("missing")))).toEqual(
      new Set(["blocked"]),
    );
  });
});
