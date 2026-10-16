import { describe, expect, it, vi } from "vitest";
import { UpdateNamingProfile } from "../../../src/application/use-cases/UpdateNamingProfile";
import type { ConfigurationWrite } from "../../../src/application/ports/ProjectRepository";
import type { GenerationRepository } from "../../../src/application/ports/GenerationRepository";
import type { ProjectRepository } from "../../../src/application/ports/ProjectRepository";
import { ok } from "../../../src/domain/shared/result";
import { namingProfileFixture } from "../../fixtures/namingProfile";

const project = {
  id: "p1",
  title: "宋姓方案",
  stage: "configuration" as const,
  status: "draft" as const,
  createdAt: "2026-10-16T00:00:00.000Z",
  updatedAt: "2026-10-16T00:00:00.000Z",
};

describe("UpdateNamingProfile", () => {
  it("saves display-only module changes without advancing the scoring revision", async () => {
    const writes: ConfigurationWrite[] = [];
    const useCase = createUseCase(writes, 0);
    const profile = namingProfileFixture("p1");

    const result = await useCase.execute({
      projectId: "p1",
      expectedRevision: 0,
      patch: {
        modules: {
          ...profile.modules,
          zodiac: { ...profile.modules.zodiac, detailsVisible: true },
        },
      },
      completeOnboarding: false,
    });

    expect(result.ok && result.value.workspace.profile.configRevision).toBe(0);
    expect(result.ok && result.value.runId).toBeUndefined();
    expect(writes).toHaveLength(1);
    expect(writes[0]?.kind).toBe("display-only");
  });

  it("advances the revision and creates a run for scoring input changes", async () => {
    const writes: ConfigurationWrite[] = [];
    const useCase = createUseCase(writes, 2);
    const profile = namingProfileFixture("p1");

    const result = await useCase.execute({
      projectId: "p1",
      expectedRevision: 0,
      patch: {
        basics: { ...profile.basics, styleTags: ["清朗自然"] },
      },
      completeOnboarding: true,
    });

    expect(result.ok && result.value.workspace.profile.configRevision).toBe(1);
    expect(result.ok && result.value.runId).toBe("run-1");
    expect(writes[0]).toMatchObject({
      kind: "scoring-inputs-changed",
      assessmentRun: { runId: "run-1", configRevision: 1, completed: 0, total: 2 },
    });
  });
});

function createUseCase(writes: ConfigurationWrite[], candidateCount: number) {
  const profile = namingProfileFixture("p1");
  const projects = {
    getWorkspace: vi.fn(async () => ({ project, profile })),
    saveConfiguration: vi.fn(async ({ write }: { write: ConfigurationWrite }) => {
      writes.push(write);
      return ok(write);
    }),
  } as unknown as ProjectRepository;
  const generations = {
    listCandidates: vi.fn(async () => Array.from({ length: candidateCount }, () => ({}))),
  } as unknown as GenerationRepository;
  return new UpdateNamingProfile(projects, generations, {
    now: () => "2026-10-16T00:01:00.000Z",
    createRunId: () => "run-1",
  });
}
