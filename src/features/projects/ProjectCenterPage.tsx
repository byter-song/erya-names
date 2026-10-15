import { useState } from "react";
import { activeRuntimeBundle } from "../../data/activeRuntimeBundle";
import { Button } from "../../design-system/primitives/Button";
import { Dialog } from "../../design-system/primitives/Dialog";
import type { ProjectSummary } from "../../application/models/ProjectSummary";
import { ProjectCard } from "./ProjectCard";
import "./project-scroll-page.css";

export interface ProjectCenterPageProps {
  projects: ProjectSummary[];
  onCreate: () => void;
  onDelete?: (projectId: string) => Promise<void>;
  onOpen?: (href: string) => void;
}

export function ProjectCenterPage({
  projects,
  onCreate,
  onDelete,
  onOpen,
}: ProjectCenterPageProps) {
  const [pendingDelete, setPendingDelete] = useState<ProjectSummary>();
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const sortedProjects = [...projects].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
  const recentProject = sortedProjects[0];
  const otherProjects = sortedProjects.filter((project) => project.id !== recentProject?.id);
  const activeProjects = projects.filter((project) => project.status !== "completed").length;
  const totalCandidates = projects.reduce((sum, project) => sum + project.candidateCount, 0);
  const totalFinalists = projects.reduce((sum, project) => sum + project.finalistCount, 0);

  const stats: Array<[string, number]> = [
    ["长卷方案", projects.length],
    ["进行中", activeProjects],
    ["候选之名", totalCandidates],
    ["定稿之名", totalFinalists],
  ];

  return (
    <main className="project-scroll-page">
      <header className="project-scroll-page__hero">
        <p className="project-center__kicker">ERYA · 长 卷 起 名</p>
        <h1>尔雅长卷</h1>
        <p>
          每个起名方案都是一卷独立长卷。沿卷展名，从灵感、初选、比较，直到定稿封存，
          名字与故事都留在你的浏览器里。
        </p>
        <div className="project-scroll-page__actions">
          <Button onClick={onCreate} type="button">
            展新卷 · 新建方案
          </Button>
          <a className="project-scroll-page__restore" href="/recovery">
            恢复已有方案
          </a>
        </div>
      </header>

      <section className="project-scroll-page__stats" aria-label="本地长卷概览">
        {stats.map(([label, value]) => (
          <div className="project-scroll-page__stat" key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </section>

      {recentProject ? (
        <section className="project-scroll-page__section">
          <h2 className="ink-section-title">
            <span>最近展卷</span>
          </h2>
          <ProjectCard
            project={recentProject}
            variant="featured"
            {...(onDelete ? { onDelete: () => setPendingDelete(recentProject) } : {})}
            {...(onOpen ? { onOpen } : {})}
          />
        </section>
      ) : (
        <section className="project-scroll-page__empty paper-card">
          <div aria-hidden="true" className="project-scroll-page__empty-seal brush-type">
            始
          </div>
          <h2>铺开第一卷</h2>
          <p>写下姓氏与家庭边界，让第一个名字在长卷上落纸。</p>
          <Button onClick={onCreate} type="button">
            展新卷 · 新建方案
          </Button>
        </section>
      )}

      {otherProjects.length ? (
        <section className="project-scroll-page__section">
          <h2 className="ink-section-title">
            <span>其他长卷</span>
            <small>{otherProjects.length} 卷</small>
          </h2>
          <div className="project-scroll-page__grid">
            {otherProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                {...(onDelete ? { onDelete: () => setPendingDelete(project) } : {})}
                {...(onOpen ? { onOpen } : {})}
              />
            ))}
          </div>
        </section>
      ) : null}

      <footer className="project-scroll-page__colophon">
        <span>{activeRuntimeBundle.characters.length} 个精选用字</span>
        <span>{activeRuntimeBundle.allusions.length} 条溯源典故</span>
        {activeRuntimeBundle.modernCombinations?.length ? (
          <span>{activeRuntimeBundle.modernCombinations.length} 个现代组合</span>
        ) : null}
        <span>数据留在浏览器 · 支持完整备份</span>
      </footer>

      {pendingDelete && onDelete ? (
        <Dialog
          title="删除起名方案"
          onClose={() => {
            if (!deleting) {
              setPendingDelete(undefined);
              setDeleteError("");
            }
          }}
        >
          <div className="project-delete-dialog">
            <p>
              确定删除“{pendingDelete.title}
              ”吗？候选姓名、评价、对比记录和最终定稿将一并从本机删除。
            </p>
            <p className="project-delete-dialog__notice">此操作无法撤销，建议先导出备份。</p>
            {deleteError ? <p role="alert">{deleteError}</p> : null}
            <div className="project-delete-dialog__actions">
              <Button
                className="project-delete-dialog__cancel"
                disabled={deleting}
                onClick={() => {
                  setPendingDelete(undefined);
                  setDeleteError("");
                }}
                type="button"
              >
                取消
              </Button>
              <Button
                className="project-delete-dialog__confirm"
                disabled={deleting}
                onClick={() => {
                  setDeleting(true);
                  setDeleteError("");
                  void onDelete(pendingDelete.id)
                    .then(() => setPendingDelete(undefined))
                    .catch((error) =>
                      setDeleteError(error instanceof Error ? error.message : "删除失败"),
                    )
                    .finally(() => setDeleting(false));
                }}
                type="button"
              >
                {deleting ? "正在删除…" : "确认删除"}
              </Button>
            </div>
          </div>
        </Dialog>
      ) : null}
    </main>
  );
}
