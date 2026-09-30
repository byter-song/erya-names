import { createRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "../../../design-system/primitives/Card";
import { getProjectResumeHref } from "../../../features/projects/ProjectCard";
import { useApplicationContainer } from "../../providers";
import { rootRoute } from "../__root";

function ProjectWorkspacePlaceholder() {
  const { projectId } = projectRoute.useParams();
  const container = useApplicationContainer();
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const getWorkspace = container.getProjectWorkspace;
    if (!getWorkspace) {
      setError("读取方案服务暂不可用，请返回方案中心后重试。");
      return () => {
        active = false;
      };
    }
    void getWorkspace
      .execute(projectId)
      .then((result) => {
        if (!active) return;
        if (!result.ok) {
          setError("未找到这个起名方案，它可能已被删除或尚未恢复。");
          return;
        }
        return router.navigate({
          href: getProjectResumeHref(result.value.project),
          replace: true,
        });
      })
      .catch(() => {
        if (active) setError("读取方案失败，请返回方案中心后重试。");
      });
    return () => {
      active = false;
    };
  }, [container, projectId, router]);

  return (
    <main className="project-center">
      <Card className="project-center__empty">
        <h1>{error ? "无法打开方案" : "方案工作区"}</h1>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <a href="/">返回方案中心</a>
          </>
        ) : (
          <p role="status">正在打开方案 {projectId}。</p>
        )}
      </Card>
    </main>
  );
}

export const projectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects/$projectId",
  component: ProjectWorkspacePlaceholder,
});
