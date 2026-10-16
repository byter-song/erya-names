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
      onRename={async (input) => {
        const result = await container.renameNamingProject?.execute(input);
        if (!result?.ok) throw new Error(result?.error ?? "重命名服务暂不可用");
        const workspace = await container.getProjectWorkspace?.execute(input.projectId);
        if (!workspace?.ok) throw new Error(workspace?.error ?? "方案读取失败");
        const renamed = {
          title: workspace.value.project.title,
          updatedAt: workspace.value.project.updatedAt,
        };
        setProjects((current) =>
          current.map((project) =>
            project.id === input.projectId ? { ...project, ...renamed } : project,
          ),
        );
        return renamed;
      }}
      onCopy={async (input) => {
        const result = await container.copyNamingConfiguration?.execute(input);
        if (!result?.ok) throw new Error(result?.error ?? "复制配置服务暂不可用");
        return result.value;
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
