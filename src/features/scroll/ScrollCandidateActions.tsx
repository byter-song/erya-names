import { useState } from "react";
import type { CandidateFunnelItem } from "../../application/models/CandidateFunnelItem";
import type { CandidateMoveDirection } from "../../domain/candidate/decisionState";

export interface ScrollActions {
  onMove: (
    id: string,
    direction: CandidateMoveDirection,
    expectedUpdatedAt: string,
  ) => Promise<void>;
  onExclude: (id: string, reason: string, expectedUpdatedAt: string) => Promise<void>;
  onRestore: (id: string, expectedUpdatedAt: string) => Promise<void>;
  onEvaluate: (id: string, rating: number | undefined, note: string) => Promise<void>;
}

export function ScrollCandidateActions({
  candidate,
  onMove,
  onExclude,
  onRestore,
  onEvaluate,
  afterMove,
  variant = "full",
}: ScrollActions & {
  candidate: CandidateFunnelItem;
  afterMove: () => void;
  variant?: "full" | "card";
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [note, setNote] = useState(candidate.note ?? "");
  const [rating, setRating] = useState(candidate.rating);
  const [reason, setReason] = useState("");

  const run = async (action: () => Promise<void>, moved = false) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      if (moved) afterMove();
      else setNotice("评价已保存");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "操作失败，请重试");
    } finally {
      setBusy(false);
    }
  };

  const move = (direction: CandidateMoveDirection) =>
    void run(() => onMove(candidate.id, direction, candidate.decisionUpdatedAt), true);

  if (variant === "card")
    return (
      <section className="ils__card-decisions" aria-label={`${candidate.fullName}筛选操作`}>
        {candidate.pool === "excluded" ? (
          <button
            className="ils__card-action ils__card-action--restore"
            disabled={busy}
            aria-label={`恢复${candidate.fullName}到排除前阶段`}
            onClick={() =>
              void run(() => onRestore(candidate.id, candidate.decisionUpdatedAt), true)
            }
            type="button"
          >
            <span aria-hidden="true">↩</span>
            <span>恢复</span>
          </button>
        ) : (
          <>
            <button
              className="ils__card-action ils__card-action--exclude"
              disabled={busy}
              aria-label={`排除${candidate.fullName}`}
              onClick={() =>
                void run(
                  () => onExclude(candidate.id, "从长卷卡片排除", candidate.decisionUpdatedAt),
                  true,
                )
              }
              type="button"
            >
              <span aria-hidden="true">⊘</span>
              <span>排除</span>
            </button>
            <div className="ils__card-decisions-right">
              {candidate.pool !== "inspiration" ? (
                <button
                  className="ils__card-action"
                  disabled={busy}
                  aria-label={`移除${candidate.fullName}并返回上一阶段`}
                  onClick={() => move("backward")}
                  type="button"
                >
                  <span aria-hidden="true">←</span>
                  <span>移除</span>
                </button>
              ) : null}
              {candidate.pool !== "selected" ? (
                <button
                  className="ils__card-action ils__card-action--select"
                  disabled={busy}
                  aria-label={`选择${candidate.fullName}进入下一阶段`}
                  onClick={() => move("forward")}
                  type="button"
                >
                  <span>选择</span>
                  <span aria-hidden="true">→</span>
                </button>
              ) : null}
            </div>
          </>
        )}
        <span className="ils__card-action-feedback" aria-live="polite">
          {notice}
          {error ? <span role="alert">{error}</span> : null}
        </span>
      </section>
    );

  return (
    <section className="ils__decisions" aria-label="候选决策">
      <div className="ils__actions">
        {candidate.pool === "excluded" ? (
          <button
            disabled={busy}
            onClick={() =>
              void run(() => onRestore(candidate.id, candidate.decisionUpdatedAt), true)
            }
          >
            恢复到上一阶段
          </button>
        ) : (
          <>
            {candidate.pool !== "inspiration" ? (
              <button disabled={busy} onClick={() => move("backward")}>
                ← 移除
              </button>
            ) : null}
            {candidate.pool !== "selected" ? (
              <button disabled={busy} onClick={() => move("forward")}>
                选择 →
              </button>
            ) : null}
          </>
        )}
      </div>

      {candidate.pool !== "excluded" ? (
        <>
          <label className="ui-field">
            <span>个人评分</span>
            <select
              value={rating ?? ""}
              onChange={(event) =>
                setRating(event.target.value ? Number(event.target.value) : undefined)
              }
            >
              <option value="">未评分</option>
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  {value} 分
                </option>
              ))}
            </select>
          </label>
          <label className="ui-field">
            <span>心选理由</span>
            <textarea
              maxLength={2000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <button
            disabled={busy}
            onClick={() => void run(() => onEvaluate(candidate.id, rating, note))}
          >
            保存评价
          </button>
          <details>
            <summary>⊘ 排除这个名字</summary>
            <label className="ui-field">
              <span>排除理由（可选）</span>
              <input
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <button
              disabled={busy}
              onClick={() =>
                void run(
                  () =>
                    onExclude(
                      candidate.id,
                      reason.trim() || "未填写理由",
                      candidate.decisionUpdatedAt,
                    ),
                  true,
                )
              }
            >
              确认排除
            </button>
          </details>
        </>
      ) : (
        <p>排除理由：{candidate.exclusionReason}</p>
      )}
      {notice ? <p role="status">{notice}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
