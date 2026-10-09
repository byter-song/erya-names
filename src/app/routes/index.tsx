import { createRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ProjectCenterPage } from "../../features/projects/ProjectCenterPage";
import type { ProjectSummary } from "../../application/models/ProjectSummary";
import { useApplicationContainer } from "../providers";
import { rootRoute } from "./__root";

function ProjectCenterRoute() {
  const navigate = useNavigate();
  const router = useRouter();
  const container = useApplicationContainer();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);

  useEffect(() => {
    void container.listProjectSummaries?.execute().then((items) => setProjects(items ?? []));
  }, [container]);
  return (
    <ProjectCenterPage
      onCreate={() => void navigate({ to: "/projects/new/$step", params: { step: "basic" } })}
      onDelete={async (projectId) => {
        const result = await container.deleteNamingProject?.execute(projectId);
        if (!result?.ok) throw new Error(result?.error ?? "删除服务暂不可用");
        setProjects((current) => current.filter((project) => project.id !== projectId));
      }}
      onOpen={(href) => void router.navigate({ href })}
      projects={projects}
    />
  );
}

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: ProjectCenterRoute,
});
