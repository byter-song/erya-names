import { useEffect, useMemo, useState } from "react";
import type { CandidateFunnelItem } from "../../application/models/CandidateFunnelItem";
import type { ExcludedCandidateSelection } from "../../application/use-cases/ClearExcludedCandidates";
import type { ActiveCandidatePool } from "../../domain/candidate/decision";
import { Button } from "../../design-system/primitives/Button";
import { Dialog } from "../../design-system/primitives/Dialog";
import "./excluded-candidates-section.css";

const poolLabels: Record<ActiveCandidatePool, string> = {
  inspiration: "灵感池",
  candidate: "候选池",
  selected: "精选池",
};

export function ExcludedCandidatesSection({
  candidates,
  canUndo = false,
  onRestore,
  onUndo,
  onClear,
}: {
  candidates: CandidateFunnelItem[];
  canUndo?: boolean;
  onRestore: (candidateId: string, expectedUpdatedAt: string) => Promise<void>;
  onUndo?: () => Promise<boolean>;
  onClear: (selected: ExcludedCandidateSelection[], confirmedCount: number) => Promise<void>;
}) {
  const excluded = useMemo(
    () => candidates.filter((candidate) => candidate.pool === "excluded"),
    [candidates],
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [restoreBusyId, setRestoreBusyId] = useState<string>();
  const [activity, setActivity] = useState<"undo" | "clear">();
  const [undoAvailable, setUndoAvailable] = useState(canUndo);
  const [confirming, setConfirming] = useState(false);
  const [confirmedCount, setConfirmedCount] = useState("");
  const [error, setError] = useState("");

  useEffect(() => setUndoAvailable(canUndo), [canUndo]);

  useEffect(() => {
    const availableIds = new Set(excluded.map((candidate) => candidate.id));
    setSelectedIds((current) => {
      const next = new Set([...current].filter((candidateId) => availableIds.has(candidateId)));
      if (next.size === current.size) return current;
      return next;
    });
  }, [excluded]);

  const selected = excluded.filter((candidate) => selectedIds.has(candidate.id));
  const isBusy = Boolean(restoreBusyId || activity);

  const toggle = (candidateId: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(candidateId);
      else next.delete(candidateId);
      return next;
    });
  };

  const restore = async (candidate: CandidateFunnelItem) => {
    setRestoreBusyId(candidate.id);
    setError("");
    try {
      await onRestore(candidate.id, candidate.decisionUpdatedAt);
      setUndoAvailable(true);
    } catch (reason) {
      setError(toMessage(reason, "恢复失败，请重试"));
    } finally {
      setRestoreBusyId(undefined);
    }
  };

  const undo = async () => {
    if (!onUndo) return;
    setActivity("undo");
    setError("");
    try {
      setUndoAvailable(await onUndo());
    } catch (reason) {
      setError(toMessage(reason, "撤销失败，请重试"));
    } finally {
      setActivity(undefined);
    }
  };

  const clear = async () => {
    if (Number(confirmedCount) !== selected.length) return;
    setActivity("clear");
    setError("");
    try {
      await onClear(
        selected.map((candidate) => ({
          candidateId: candidate.id,
          expectedUpdatedAt: candidate.decisionUpdatedAt,
        })),
        Number(confirmedCount),
      );
      setSelectedIds(new Set());
      setConfirming(false);
      setConfirmedCount("");
    } catch (reason) {
      setError(toMessage(reason, "永久清空失败，请重试"));
    } finally {
      setActivity(undefined);
    }
  };

  const openConfirmation = () => {
    setConfirmedCount("");
    setError("");
    setConfirming(true);
  };

  return (
    <section className="excluded-candidates" aria-labelledby="excluded-candidates-title">
      <header className="excluded-candidates__heading">
        <div>
          <p className="excluded-candidates__eyebrow">筛选留痕</p>
          <h2 id="excluded-candidates-title">已排除的名字</h2>
          <p>排除不会立即删除资料，可恢复到排除前所在的池。</p>
        </div>
        {onUndo ? (
          <button
            aria-label="撤销本次会话最近一次名字操作"
            className="excluded-candidates__control"
            disabled={!undoAvailable || isBusy}
            onClick={() => void undo()}
            type="button"
          >
            {activity === "undo" ? "正在撤销…" : "撤销最近操作"}
          </button>
        ) : null}
      </header>

      {error ? <p role="alert">{error}</p> : null}

      {excluded.length === 0 ? (
        <p className="excluded-candidates__empty">目前没有已排除的名字。</p>
      ) : (
        <>
          <div className="excluded-candidates__selection">
            <label>
              <input
                checked={selected.length === excluded.length}
                disabled={isBusy}
                onChange={(event) =>
                  setSelectedIds(
                    event.target.checked
                      ? new Set(excluded.map((candidate) => candidate.id))
                      : new Set(),
                  )
                }
                type="checkbox"
              />
              全选 {excluded.length} 个名字
            </label>
            <span aria-live="polite">已勾选 {selected.length} 个</span>
          </div>

          <ul className="excluded-candidates__list">
            {excluded.map((candidate) => (
              <li className="excluded-candidates__item" key={candidate.id}>
                <label className="excluded-candidates__check">
                  <input
                    aria-label={`选择永久清空${candidate.fullName}`}
                    checked={selectedIds.has(candidate.id)}
                    disabled={isBusy}
                    onChange={(event) => toggle(candidate.id, event.target.checked)}
                    type="checkbox"
                  />
                  <span className="excluded-candidates__name">{candidate.fullName}</span>
                </label>
                <dl>
                  <div>
                    <dt>原池</dt>
                    <dd>{poolLabels[candidate.lastActivePool ?? "inspiration"]}</dd>
                  </div>
                  <div>
                    <dt>排除理由</dt>
                    <dd>{candidate.exclusionReason ?? "未填写理由"}</dd>
                  </div>
                  <div>
                    <dt>排除时间</dt>
                    <dd>
                      {candidate.excludedAt ? (
                        <time dateTime={candidate.excludedAt}>
                          {formatExcludedAt(candidate.excludedAt)}
                        </time>
                      ) : (
                        "时间未记录"
                      )}
                    </dd>
                  </div>
                </dl>
                <Button
                  aria-label={`恢复${candidate.fullName}到${poolLabels[candidate.lastActivePool ?? "inspiration"]}`}
                  disabled={isBusy}
                  onClick={() => void restore(candidate)}
                  type="button"
                >
                  {restoreBusyId === candidate.id ? "正在恢复…" : "恢复到原池"}
                </Button>
              </li>
            ))}
          </ul>

          <div className="excluded-candidates__danger-zone">
            <div>
              <strong>永久清空会删除完整名字资料</strong>
              <p>所选名字的来源、评分、评价和操作历史会一并删除，无法撤销。</p>
            </div>
            <button
              aria-label={`永久清空已勾选的 ${selected.length} 个名字`}
              className="excluded-candidates__clear-trigger"
              disabled={selected.length === 0 || isBusy}
              onClick={openConfirmation}
              type="button"
            >
              永久清空已选（{selected.length}）
            </button>
          </div>
        </>
      )}

      {confirming ? (
        <Dialog
          closeLabel="取消"
          title="确认永久清空"
          {...(activity === "clear" ? {} : { onClose: () => setConfirming(false) })}
        >
          <div className="excluded-candidates__confirm">
            <p>
              <strong>这项操作无法撤销。</strong>
              将永久删除已勾选的 {selected.length} 个名字及其全部资料。
            </p>
            <label>
              输入数字 {selected.length} 以确认
              <input
                aria-describedby="excluded-clear-help"
                autoFocus
                disabled={activity === "clear"}
                inputMode="numeric"
                onChange={(event) => setConfirmedCount(event.target.value)}
                pattern="[0-9]*"
                value={confirmedCount}
              />
            </label>
            <p id="excluded-clear-help">确认数量必须与本次勾选数量完全一致。</p>
            <button
              aria-label={`确认永久删除 ${selected.length} 个名字`}
              className="excluded-candidates__confirm-clear"
              disabled={Number(confirmedCount) !== selected.length || activity === "clear"}
              onClick={() => void clear()}
              type="button"
            >
              {activity === "clear" ? "正在永久删除…" : `确认永久删除 ${selected.length} 个`}
            </button>
          </div>
        </Dialog>
      ) : null}
    </section>
  );
}

function formatExcludedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function toMessage(reason: unknown, fallback: string): string {
  return reason instanceof Error ? reason.message : fallback;
}
