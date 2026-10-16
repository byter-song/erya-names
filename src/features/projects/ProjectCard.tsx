import { useState, type FormEvent } from "react";
import type { ProjectSummary, ResumableProject } from "../../application/models/ProjectSummary";
import { Status } from "../../design-system/primitives/Status";
import "./project-card.css";

const STAGE_LABELS: Record<ProjectSummary["stage"], string> = {
  configuration: "统一配置",
  naming: "名字长卷",
  export: "精选导出",
};

export interface RenameProjectInput {
  projectId: string;
  title: string;
  expectedUpdatedAt: string;
}

export interface RenameProjectResult {
  title: string;
  updatedAt: string;
}

export interface CopyProjectInput {
  sourceProjectId: string;
  title: string;
}

export function getProjectResumeHref(project: ResumableProject): string {
  if (project.status === "completed" || project.stage === "export")
    return `/projects/${project.id}/export`;
  if (project.stage === "configuration") return `/projects/${project.id}/config`;
  return `/projects/${project.id}/names`;
}

export function ProjectCard({
  project,
  onCopy,
  onDelete,
  onOpen,
  onRename,
  variant = "orbit",
}: {
  project: ProjectSummary;
  onCopy?: (input: CopyProjectInput) => Promise<{ projectId: string }>;
  onDelete?: () => void;
  onOpen?: (href: string) => void;
  onRename?: (input: RenameProjectInput) => Promise<RenameProjectResult>;
  variant?: "featured" | "orbit";
}) {
  const [editor, setEditor] = useState<"rename" | "copy">();
  const [title, setTitle] = useState(project.title);
  const [updatedAt, setUpdatedAt] = useState(project.updatedAt);
  const [draftTitle, setDraftTitle] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const resumeHref = getProjectResumeHref(project);

  function openEditor(mode: "rename" | "copy") {
    setEditor(mode);
    setDraftTitle(mode === "rename" ? title : `${title} · 副本`);
    setError("");
  }

  async function submitEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const nextTitle = draftTitle.trim();
    if (!nextTitle) {
      setError("请输入方案版本名");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editor === "rename" && onRename) {
        const renamed = await onRename({
          projectId: project.id,
          title: nextTitle,
          expectedUpdatedAt: updatedAt,
        });
        setTitle(renamed.title);
        setUpdatedAt(renamed.updatedAt);
        setEditor(undefined);
      }
      if (editor === "copy" && onCopy) {
        const copied = await onCopy({ sourceProjectId: project.id, title: nextTitle });
        onOpen?.(`/projects/${copied.projectId}/config`);
        setEditor(undefined);
      }
    } catch (caught) {
      setError(projectActionError(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className={`project-card project-card--${variant} paper-card`}>
      <header className="project-card__header">
        <div>
          <p className="project-card__eyebrow">{project.surname}姓方案</p>
          <h3>{title}</h3>
        </div>
        <Status>
          {project.status === "completed" ? "已完成" : STAGE_LABELS[project.stage]}
        </Status>
      </header>

      {editor ? (
        <form className="project-card__editor" onSubmit={(event) => void submitEditor(event)}>
          <label htmlFor={`${project.id}-${editor}-title`}>
            {editor === "rename" ? "方案版本名" : "新版本名"}
          </label>
          <div className="project-card__editor-row">
            <input
              autoFocus
              id={`${project.id}-${editor}-title`}
              maxLength={80}
              onChange={(event) => setDraftTitle(event.target.value)}
              value={draftTitle}
            />
            <button disabled={saving} type="submit">
              {saving ? "正在保存…" : editor === "rename" ? "保存名称" : "复制配置"}
            </button>
            <button
              disabled={saving}
              onClick={() => {
                setEditor(undefined);
                setError("");
              }}
              type="button"
            >
              取消
            </button>
          </div>
          {error ? <p role="alert">{error}</p> : null}
        </form>
      ) : null}

      <div className="project-card__metrics" aria-label="候选池数量">
        <span>灵感 {project.poolCounts.inspiration}</span>
        <span>候选 {project.poolCounts.candidate}</span>
        <span>精选 {project.poolCounts.selected}</span>
        <span>排除 {project.poolCounts.excluded}</span>
      </div>
      <footer className="project-card__footer">
        <span>更新于 {new Date(updatedAt).toLocaleDateString("zh-CN")}</span>
        <span className="project-card__actions">
          {onRename ? (
            <button
              aria-label={`重命名方案${title}`}
              className="project-card__secondary-action"
              onClick={() => openEditor("rename")}
              type="button"
            >
              改名
            </button>
          ) : null}
          {onCopy ? (
            <button
              aria-label={`复制配置${title}`}
              className="project-card__secondary-action"
              onClick={() => openEditor("copy")}
              type="button"
            >
              复制
            </button>
          ) : null}
          {onDelete ? (
            <button
              aria-label={`删除方案${title}`}
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

function projectActionError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("project-stale")) return "方案已在其他位置更新，请刷新后重试";
  if (message.includes("project-id-conflict")) return "复制版本发生冲突，请重试";
  return message || "保存失败，请重试";
}
