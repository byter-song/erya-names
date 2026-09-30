export function namingProjectFixture(projectId = "project-song") {
  return {
    id: projectId,
    title: "宋姓宝宝起名",
    stage: "generation" as const,
    status: "active" as const,
    createdAt: "2026-09-17T00:00:00.000Z",
    updatedAt: "2026-09-17T00:00:00.000Z",
  };
}
