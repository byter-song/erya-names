import { describe, expect, it } from "vitest";
import { GetProjectJourneyView } from "../../../src/application/use-cases/GetProjectJourneyView";
import type { ProjectRepository } from "../../../src/application/ports/ProjectRepository";
import type { GenerationRepository } from "../../../src/application/ports/GenerationRepository";

function createUseCase(
  stages: string[],
  constraintKnowledge: "none" | "unknown",
  folkloreReviewed = false,
) {
  const projects = {
    getWorkspace: async () => ({
      project: { id: "p1" },
      profile: { constraintKnowledge },
    }),
  } as unknown as ProjectRepository;
  const generations = {
    countBatches: async () => 1,
    listCandidates: async () =>
      stages.map((stage, index) => ({
        decision: {
          stage,
          candidateId: `c${index}`,
          projectId: "p1",
          ...(folkloreReviewed && stage === "comparison" ? { folkloreReviewed: true } : {}),
        },
      })),
  } as unknown as GenerationRepository;
  return new GetProjectJourneyView(projects, generations);
}

describe("GetProjectJourneyView", () => {
  it("derives stage availability from persisted decisions instead of URL order", async () => {
    const view = await createUseCase(["inbox", "basic_shortlist"], "none").execute("p1");

    expect(view).toEqual({
      inbox: "completed",
      basic: "completed",
      folklore: "optional",
      compare: "available",
      finalize: "blocked",
    });
  });

  it("keeps later stages blocked while family rules are pending", async () => {
    const view = await createUseCase(["comparison", "finalist"], "unknown").execute("p1");

    expect(view.compare).toBe("blocked");
    expect(view.finalize).toBe("blocked");
  });

  it("does not mark folklore complete when candidates skipped that stage", async () => {
    const skipped = await createUseCase(["comparison"], "none").execute("p1");
    const reviewed = await createUseCase(["comparison"], "none", true).execute("p1");

    expect(skipped.folklore).toBe("optional");
    expect(reviewed.folklore).toBe("completed");
  });
});
