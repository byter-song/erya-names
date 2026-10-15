import { useState } from "react";
import { Button } from "../../design-system/primitives/Button";
import "../comparison/comparison.css";

export interface FinalistView {
  id: string;
  fullName: string;
  summary: string;
  rating?: number;
  note?: string;
  eligibilityIssue?: string;
}
export function FinalizationPage({
  candidates,
  onRemove,
  onExclude,
  onExport,
  onSavePreferred,
  onSaveNote,
  onReport,
  legacyDecision,
}: {
  candidates: FinalistView[];
  onRemove: (id: string) => Promise<void>;
  onExclude: (id: string, reason: string) => Promise<void>;
  onExport: () => Promise<void>;
  onSavePreferred?: (id: string, rationale: string) => Promise<void>;
  onSaveNote?: (id: string, note: string) => Promise<void>;
  onReport?: () => Promise<void>;
  legacyDecision?: {
    selectedCandidateId: string;
    selectedCandidateName?: string;
    rationale: string;
    updatedAt: string;
  };
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState(legacyDecision?.selectedCandidateId ?? "");
  const [rationale, setRationale] = useState(legacyDecision?.rationale ?? "");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const issues = candidates.filter((c) => c.eligibilityIssue);
  const dirty =
    selected !== (legacyDecision?.selectedCandidateId ?? "") ||
    rationale !== (legacyDecision?.rationale ?? "") ||
    candidates.some((c) => notes[c.id] !== undefined && notes[c.id] !== (c.note ?? ""));
  const run = async (action: () => Promise<void>, message: string) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败，请重试");
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="finalization-page finalization-page--seal no-print">
      <header className="final-seal-hero">
        <div>
          <p className="project-center__kicker">尔雅 · 收卷定名</p>
          <h1>定稿名单</h1>
          <p>保留 1–5 个名字，可指定一个首选。写下每个名字的理由，保存后可随备份恢复。</p>
        </div>
        <div className="final-seal-hero__meta">
          <span>定稿候选</span>
          <strong>{candidates.length} / 5</strong>
        </div>
      </header>
      {!!issues.length && (
        <p role="alert">
          当前条件发生变化：
          {issues.map((c) => `${c.fullName}：${c.eligibilityIssue}`).join("；")}
          。请调整条件或移回重点候选，核对后再保存首选及导出。
        </p>
      )}
      <section className="paper-card final-preference" aria-label="首选与选择理由">
        <h2>本次首选（可选）</h2>
        <label className="ui-field">
          <span>选择首选名字</span>
          <select
            value={candidates.some((c) => c.id === selected) ? selected : ""}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="" disabled>
              暂不指定首选
            </option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName}
              </option>
            ))}
          </select>
        </label>
        <label className="ui-field">
          <span>家庭选择理由</span>
          <textarea
            maxLength={2000}
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder="写下为什么选择这个名字；保存后会进入报告。"
          />
        </label>
        <Button
          disabled={
            busy || !selected || !rationale.trim() || !!issues.length || !onSavePreferred
          }
          onClick={() =>
            void run(() => onSavePreferred!(selected, rationale), "首选和选择理由已保存")
          }
          type="button"
        >
          保存首选与理由
        </Button>
        {legacyDecision && (
          <p>
            已保存首选：
            {legacyDecision.selectedCandidateName ??
              candidates.find((c) => c.id === legacyDecision.selectedCandidateId)?.fullName ??
              "待核对"}{" "}
            · {new Date(legacyDecision.updatedAt).toLocaleString("zh-CN")}
          </p>
        )}
      </section>
      <section className="final-seal-list" aria-label="定稿名单名字">
        {candidates.map((candidate) => (
          <article
            className="final-seal-list__item"
            data-final-candidate-id={candidate.id}
            key={candidate.id}
          >
            <h2>
              {candidate.fullName}
              {candidate.id === legacyDecision?.selectedCandidateId ? " · 首选" : ""}
            </h2>
            <p>{candidate.summary}</p>
            <p>{candidate.rating ? `个人评分 ${candidate.rating} 分` : "未评分"}</p>
            <label className="ui-field">
              <span>{candidate.fullName}的保留理由</span>
              <textarea
                maxLength={2000}
                value={notes[candidate.id] ?? candidate.note ?? ""}
                onChange={(e) => setNotes({ ...notes, [candidate.id]: e.target.value })}
              />
            </label>
            <div className="candidate-card__actions">
              <button
                disabled={busy || !onSaveNote}
                onClick={() =>
                  void run(
                    () =>
                      onSaveNote!(candidate.id, notes[candidate.id] ?? candidate.note ?? ""),
                    `${candidate.fullName}的理由已保存`,
                  )
                }
              >
                保存这个名字的理由
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  void run(() => onRemove(candidate.id), "已移回重点候选；首选记录需重新确认")
                }
              >
                移除到重点候选
              </button>
            </div>
            <details className="candidate-dismiss">
              <summary>排除这个名字</summary>
              <label>
                排除理由{candidate.fullName}
                <input
                  maxLength={500}
                  value={reasons[candidate.id] ?? ""}
                  onChange={(e) => setReasons({ ...reasons, [candidate.id]: e.target.value })}
                />
              </label>
              <button
                disabled={busy}
                onClick={() =>
                  void run(
                    () => onExclude(candidate.id, reasons[candidate.id] || "从定稿名单排除"),
                    "已排除，可回长卷恢复",
                  )
                }
              >
                排除
              </button>
            </details>
          </article>
        ))}
      </section>
      {dirty && <p role="status">有尚未保存的修改，请先保存后再导出。</p>}
      <div className="final-seal-actions">
        <Button
          disabled={busy || dirty || !!issues.length || !candidates.length}
          onClick={() => void run(onExport, "定稿名单已导出；当前名单仍可继续调整。")}
          type="button"
        >
          导出定稿名单
        </Button>
        {onReport && (
          <Button
            disabled={busy || dirty || !!issues.length || !candidates.length}
            onClick={() => void run(onReport, "报告已生成")}
            type="button"
          >
            查看定稿报告 / 打印 PDF
          </Button>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </main>
  );
}
