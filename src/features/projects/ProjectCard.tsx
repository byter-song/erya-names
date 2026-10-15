import { Status } from "../../design-system/primitives/Status";
import type { ProjectSummary, ResumableProject } from "../../application/models/ProjectSummary";
import "./project-card.css";

const STAGE_LABELS: Record<ProjectSummary["stage"], string> = {
  onboarding: "完善条件",
  generation: "灵感池",
  funnel: "基础 / 民俗候选",
  comparison: "重点候选",
  finalization: "定稿名单",
};

export function getProjectResumeHref(project: ResumableProject): string {
  if (project.status === "completed" || project.stage === "finalization")
    return `/projects/${project.id}/finalize`;
  if (project.stage === "comparison") return `/projects/${project.id}/compare`;
  if (project.stage === "onboarding") return `/projects/${project.id}/generate#conditions`;
  return `/projects/${project.id}/generate`;
}

export function ProjectCard({
  project,
  onDelete,
  onOpen,
  variant = "orbit",
}: {
  project: ProjectSummary;
  onDelete?: () => void;
  onOpen?: (href: string) => void;
  variant?: "featured" | "orbit";
}) {
  const resumeHref = getProjectResumeHref(project);
  return (
    <article className={`project-card project-card--${variant} paper-card`}>
      <header className="project-card__header">
        <div>
          <p className="project-card__eyebrow">{project.surname}姓方案</p>
          <h3>{project.title}</h3>
        </div>
        <Status>
          {project.status === "completed" ? "已完成" : STAGE_LABELS[project.stage]}
        </Status>
      </header>
      <div className="project-card__metrics">
        <span>候选 {project.candidateCount}</span>
        <span>初选 {project.favoriteCount}</span>
        <span>定稿 {project.finalistCount} / 5</span>
      </div>
      <footer className="project-card__footer">
        <span>更新于 {new Date(project.updatedAt).toLocaleDateString("zh-CN")}</span>
        <span className="project-card__actions">
          {onDelete ? (
            <button
              aria-label={`删除方案${project.title}`}
              className="project-card__delete"
              onClick={onDelete}
              type="button"
            >
              删除
            </button>
          ) : null}
          <a
            className="project-card__continue"
            href={resumeHref}
            onClick={(event) => {
              if (
                !onOpen ||
                event.defaultPrevented ||
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              )
                return;
              event.preventDefault();
              onOpen(resumeHref);
            }}
          >
            继续方案
          </a>
        </span>
      </footer>
    </article>
  );
}
