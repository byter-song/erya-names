import { useRef, useState } from "react";
import { Button } from "../../design-system/primitives/Button";
import { Card } from "../../design-system/primitives/Card";
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
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const titleRef = useRef<HTMLHeadingElement>(null);

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
    <main className="finalization-page no-print">
      <header>
        <p className="project-center__kicker">FINAL LIST</p>
        <h1 ref={titleRef} tabIndex={-1}>
          定稿名单
        </h1>
        <p>可保留 1–5 个名字一起讨论和导出；名单不是只能选一个，导出后仍可继续筛选。</p>
      </header>
      <section className="finalization-page__grid" aria-label="定稿名单名字">
        {candidates.map((candidate) => (
          <Card
            className="finalization-card"
            data-final-candidate-id={candidate.id}
            key={candidate.id}
          >
            <h2>{candidate.fullName}</h2>
            <p>{candidate.summary}</p>
            <p>{candidate.rating ? `${candidate.rating} 分` : "未评分"}</p>
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
          </Card>
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
      <div style={{ marginTop: 18 }}>
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
