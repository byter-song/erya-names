import { useRef, useState } from "react";
import { Button } from "../../design-system/primitives/Button";
import "../comparison/comparison.css";

export interface FinalistView {
  id: string;
  fullName: string;
  summary: string;
  rating?: number;
}

export function FinalizationPage({
  candidates,
  onRemove,
  onExclude,
  onExport,
  legacyDecision,
}: {
  candidates: FinalistView[];
  onRemove: (candidateId: string) => Promise<void>;
  onExclude: (candidateId: string, reason: string) => Promise<void>;
  onExport: () => Promise<void>;
  legacyDecision?: {
    selectedCandidateId: string;
    selectedCandidateName?: string;
    rationale: string;
    updatedAt: string;
  };
}) {
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState("");
  const [exported, setExported] = useState(false);
  const [focusedId, setFocusedId] = useState(
    legacyDecision?.selectedCandidateId ?? candidates[0]?.id,
  );
  const [rationale, setRationale] = useState(legacyDecision?.rationale ?? "");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const titleRef = useRef<HTMLHeadingElement>(null);
  const focusedCandidate =
    candidates.find((candidate) => candidate.id === focusedId) ?? candidates[0];
  const backupCandidates = candidates.filter((candidate) => candidate.id !== focusedCandidate?.id);

  const run = async (id: string, action: () => Promise<void>) => {
    setBusyId(id);
    setError("");
    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "操作失败，请重试");
    } finally {
      setBusyId(undefined);
    }
  };
  const focusAfterRemoval = (candidateId: string) => {
    const ids = candidates.map((candidate) => candidate.id);
    const index = ids.indexOf(candidateId);
    const nextId = ids[index + 1] ?? ids[index - 1];
    requestAnimationFrame(() => {
      const nextCard = nextId
        ? [...document.querySelectorAll<HTMLElement>("[data-final-candidate-id]")].find(
            (element) => element.dataset.finalCandidateId === nextId,
          )
        : undefined;
      (nextCard?.querySelector<HTMLElement>("button") ?? titleRef.current)?.focus();
    });
  };

  return (
    <main className="finalization-page finalization-page--seal no-print">
      <header className="final-seal-hero">
        <div>
          <p className="project-center__kicker">FINAL SEAL</p>
          <h1 ref={titleRef} tabIndex={-1}>
            封存这一刻
          </h1>
          <p>最终候选进入中心，备选环绕其侧。导出后仍可回到重点候选继续调整。</p>
        </div>
        <div className="final-seal-hero__meta" aria-label="定稿状态">
          <span>定稿候选</span>
          <strong>{candidates.length} / 5</strong>
        </div>
      </header>

      <section className="final-seal-stage" aria-label="最终封存场景">
        {focusedCandidate ? (
          <article className="final-seal-primary" data-final-candidate-id={focusedCandidate.id}>
            <span>当前聚焦</span>
            <h2>{focusedCandidate.fullName}</h2>
            <p>{focusedCandidate.summary}</p>
            <strong>{focusedCandidate.rating ? `${focusedCandidate.rating} 分` : "未评分"}</strong>
          </article>
        ) : null}

        <div className="final-seal-orbit" aria-label="备选定稿候选">
          {backupCandidates.map((candidate, index) => (
            <button
              className="final-seal-orbit__item"
              data-final-candidate-id={candidate.id}
              key={candidate.id}
              type="button"
              onClick={() => setFocusedId(candidate.id)}
            >
              <span>备选 {index + 1}</span>
              <strong>{candidate.fullName}</strong>
              <small>{candidate.rating ? `${candidate.rating} 分` : "未评分"}</small>
            </button>
          ))}
        </div>

        <label className="final-seal-rationale">
          家庭选择理由
          <textarea
            maxLength={2000}
            placeholder="写下为什么想把这个名字留在最终名单里。本片暂不持久化，导出仍以当前名单为准。"
            value={rationale}
            onChange={(event) => setRationale(event.target.value)}
          />
        </label>
      </section>

      <section className="final-seal-list" aria-label="定稿名单名字">
        {candidates.map((candidate) => (
          <article
            className="final-seal-list__item"
            data-final-candidate-id={candidate.id}
            data-selected={candidate.id === focusedCandidate?.id}
            key={candidate.id}
          >
            <button
              aria-pressed={candidate.id === focusedCandidate?.id}
              className="final-seal-list__name"
              type="button"
              onClick={() => setFocusedId(candidate.id)}
            >
              <strong>{candidate.fullName}</strong>
              <span>{candidate.rating ? `${candidate.rating} 分` : "未评分"}</span>
            </button>
            <p>{candidate.summary}</p>
            <div className="candidate-card__actions">
              <Button
                disabled={Boolean(busyId)}
                onClick={() =>
                  void run(candidate.id, () => onRemove(candidate.id)).then(() =>
                    focusAfterRemoval(candidate.id),
                  )
                }
                type="button"
              >
                移除到重点候选
              </Button>
            </div>
            <details className="candidate-dismiss">
              <summary>排除这个名字</summary>
              <input
                aria-label={`排除理由${candidate.fullName}`}
                onChange={(event) =>
                  setReasons((current) => ({
                    ...current,
                    [candidate.id]: event.target.value,
                  }))
                }
                placeholder="可选：记下原因"
                value={reasons[candidate.id] ?? ""}
              />
              <button
                disabled={Boolean(busyId)}
                onClick={() =>
                  void run(candidate.id, () =>
                    onExclude(candidate.id, reasons[candidate.id] || "从定稿名单排除"),
                  ).then(() => focusAfterRemoval(candidate.id))
                }
                type="button"
              >
                排除
              </button>
            </details>
          </article>
        ))}
      </section>
      {legacyDecision ? (
        <section className="paper-card" aria-label="历史单一定稿记录">
          <h2>历史单一定稿记录（只读）</h2>
          <p>
            旧版本最终选择：
            {legacyDecision.selectedCandidateName ?? legacyDecision.selectedCandidateId}
          </p>
          <p>{legacyDecision.rationale}</p>
          <p>新定稿名单不会改写这条历史记录；调整名单后，旧记录会按兼容规则失效。</p>
        </section>
      ) : null}
      <div className="final-seal-actions">
        <Button
          disabled={Boolean(busyId) || candidates.length < 1 || candidates.length > 5}
          onClick={() =>
            void run("export", async () => {
              await onExport();
              setExported(true);
            })
          }
          type="button"
        >
          导出定稿名单
        </Button>
      </div>
      {error ? <p role="alert">{error}</p> : null}
      {exported ? <p role="status">定稿名单已导出；当前名单仍可继续调整。</p> : null}
    </main>
  );
}
