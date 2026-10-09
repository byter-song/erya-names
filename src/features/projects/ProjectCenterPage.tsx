import { useState } from "react";
import { activeRuntimeBundle } from "../../data/activeRuntimeBundle";
import { Button } from "../../design-system/primitives/Button";
import { Card } from "../../design-system/primitives/Card";
import { Dialog } from "../../design-system/primitives/Dialog";
import type { ProjectSummary } from "../../application/models/ProjectSummary";
import { ProjectCard } from "./ProjectCard";
import "./project-center.css";

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
  const recentProject = [...projects].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  )[0];

  return (
    <main className="project-center">
      <header className="project-center__hero">
        <div>
          <p className="project-center__kicker">ERYA NAMES · 为新生，落一笔美好</p>
          <h1>{recentProject ? "继续最近方案" : "开始第一个起名方案"}</h1>
          <p>
            一字一意，一名一生。从诗文与自然拾取灵感，为中国宝宝留下一份可读、可用、可珍藏的名字。
          </p>
        </div>
        <Button onClick={onCreate} type="button">
          新建起名方案
        </Button>
      </header>

      {recentProject ? (
        <section aria-label="最近方案" className="project-center__recent">
          <ProjectCard
            project={recentProject}
            {...(onDelete ? { onDelete: () => setPendingDelete(recentProject) } : {})}
            {...(onOpen ? { onOpen } : {})}
          />
        </section>
      ) : (
        <Card className="project-center__empty">
          <div aria-hidden="true" className="project-center__seal">
            始
          </div>
          <h2>尚未创建方案</h2>
          <p>填写姓氏、家庭习惯与风格偏好。批量生成、同页初选，把心动的名字慢慢留下。</p>
        </Card>
      )}

      {projects.length > 1 ? (
        <section aria-label="全部起名方案" className="project-center__all">
          <h2>其他方案</h2>
          <div className="project-center__journey">
            {projects
              .filter((project) => project.id !== recentProject?.id)
              .map((project) => (
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
      <section aria-label="起名流程" className="project-center__journey">
        {[
          ["一", "建立条件", "姓氏结构、家庭硬约束和风格偏好"],
          ["二", "拾字选名", "批量生成与筛选同页，喜欢才收入候选"],
          ["三", "家庭定稿", "评分、对比并保存最终候选"],
        ].map(([number, title, description]) => (
          <Card className="project-center__step" key={number}>
            <span>{number}</span>
            <h2>{title}</h2>
            <p>{description}</p>
          </Card>
        ))}
      </section>
      <section className="project-center__colophon">
        <div>
          <span>{activeRuntimeBundle.characters.length}</span> 个精选用字
        </div>
        <div>
          <span>{activeRuntimeBundle.allusions.length}</span> 条溯源典故
        </div>
        {activeRuntimeBundle.modernCombinations?.length ? (
          <div>
            <span>{activeRuntimeBundle.modernCombinations.length}</span> 个现代组合
          </div>
        ) : null}
        <div>数据留在你的浏览器 · 支持完整备份</div>
        <a href="/recovery">恢复已有方案 ↗</a>
      </section>
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
