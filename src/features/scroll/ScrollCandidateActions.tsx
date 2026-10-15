import { useState } from "react";
import type { CandidateFunnelItem } from "../../application/models/CandidateFunnelItem";
import type { CandidateStage } from "../../domain/candidate/decision";

export interface ScrollActions {
  onMove: (id: string, to: CandidateStage, reason?: string) => Promise<void>;
  onEvaluate: (id: string, rating: number | undefined, note: string) => Promise<void>;
}
export function ScrollCandidateActions({
  candidate,
  onMove,
  onEvaluate,
  afterMove,
}: ScrollActions & { candidate: CandidateFunnelItem; afterMove: () => void }) {
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
  const move = (to: CandidateStage) =>
    void run(() => onMove(candidate.id, to, reason.trim() || "暂不考虑"), true);
  const excluded = ["excluded", "rejected"].includes(candidate.stage);
  return (
    <section className="ils__decisions" aria-label="候选决策">
      <div className="ils__actions">
        {candidate.stage === "inbox" && (
          <button disabled={busy} onClick={() => move("basic_shortlist")}>
            保留到基础候选
          </button>
        )}
        {["basic_shortlist", "favorite"].includes(candidate.stage) && (
          <>
            <button disabled={busy} onClick={() => move("folklore_review")}>
              进入民俗候选
            </button>
            <button disabled={busy} onClick={() => move("comparison")}>
              跳过民俗，加入重点候选
            </button>
            <button disabled={busy} onClick={() => move("inbox")}>
              退回灵感池
            </button>
          </>
        )}
        {candidate.stage === "folklore_review" && (
          <>
            <button disabled={busy} onClick={() => move("comparison")}>
              加入重点候选
            </button>
            <button disabled={busy} onClick={() => move("basic_shortlist")}>
              退回基础候选
            </button>
          </>
        )}
        {excluded && (
          <button disabled={busy} onClick={() => move("inbox")}>
            恢复到灵感池
          </button>
        )}
      </div>
      {!excluded && (
        <>
          <label className="ui-field">
            <span>个人评分</span>
            <select
              value={rating ?? ""}
              onChange={(e) => setRating(e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">未评分</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} 分
                </option>
              ))}
            </select>
          </label>
          <label className="ui-field">
            <span>心选理由</span>
            <textarea maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <button
            disabled={busy}
            onClick={() => void run(() => onEvaluate(candidate.id, rating, note))}
          >
            保存评价
          </button>
          <details>
            <summary>暂不考虑这个名字</summary>
            <label className="ui-field">
              <span>排除理由（可选）</span>
              <input
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <button disabled={busy} onClick={() => move("excluded")}>
              排除
            </button>
          </details>
        </>
      )}
      {excluded && <p>排除理由：{candidate.rejectionReason}</p>}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
