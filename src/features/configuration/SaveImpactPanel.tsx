import type { ConfigurationImpactSummary } from "../../application/use-cases/SaveNamingConfiguration";
import type { AssessmentRun } from "../../domain/rules/assessmentRun";

export function SaveImpactPanel({
  impact,
  run,
  saving = false,
  onSave,
}: {
  impact?: ConfigurationImpactSummary;
  run?: AssessmentRun;
  saving?: boolean;
  onSave: () => void;
}) {
  const percent = run && run.total > 0 ? Math.round((run.completed / run.total) * 100) : 0;
  return (
    <aside className="configuration-save-panel" aria-labelledby="save-impact-title">
      <h3 id="save-impact-title">保存影响</h3>
      {impact ? (
        <>
          <p>
            变化章节：{impact.changedSections.length ? impact.changedSections.join("、") : "无"}
          </p>
          <p>
            {impact.recalculationRequired
              ? `将重新分析 ${impact.affectedCandidateCount} 个名字。`
              : "只改变详情显示，无需重新评分。"}
          </p>
          {impact.missingInputs.length ? (
            <p role="alert">仍需补充：{impact.missingInputs.join("、")}</p>
          ) : null}
        </>
      ) : (
        <p>修改配置后会在这里预览影响。</p>
      )}
      {run ? (
        <div aria-live="polite">
          <label htmlFor="assessment-progress">
            重算进度 {run.completed}/{run.total}（{percent}%）
          </label>
          <progress
            id="assessment-progress"
            max={Math.max(1, run.total)}
            value={run.completed}
          />
          <span>
            {run.status === "completed"
              ? "分析完成"
              : run.status === "failed"
                ? "分析失败，可到名字长卷重新分析"
                : run.status === "cancelled"
                  ? "分析已取消，可到名字长卷重新分析"
                  : "分析进行中"}
          </span>
        </div>
      ) : null}
      <button disabled={saving} onClick={onSave} type="button">
        {saving ? "正在保存…" : "保存配置"}
      </button>
    </aside>
  );
}
