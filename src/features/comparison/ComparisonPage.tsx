import { Dialog } from "../../design-system/primitives/Dialog";
import { Card } from "../../design-system/primitives/Card";
import { Button } from "../../design-system/primitives/Button";
import { useEffect, useRef, useState } from "react";
import type { FunnelCandidate } from "../funnel/CandidateFunnelPage";
import type { ComparisonSnapshot } from "../../domain/candidate/comparisonSnapshot";
import type { ComparisonSnapshotCandidate } from "../../domain/candidate/comparisonSnapshot";
import { calculateSystemScore } from "../../domain/rules/scoring/systemScore";
import "./comparison.css";

export function ComparisonPage({
  candidates,
  finalists = [],
  onPromote,
  onReturnToComparison,
  onSaveSnapshot,
  onOpenFinalization,
  onUndo,
  snapshots = [],
  initialCanUndo = false,
}: {
  candidates: FunnelCandidate[];
  finalists?: FunnelCandidate[];
  onPromote: (candidateId: string) => Promise<void>;
  onReturnToComparison?: (candidateId: string) => Promise<void>;
  onSaveSnapshot?: (candidates: FunnelCandidate[], name: string) => Promise<void>;
  onOpenFinalization?: () => void;
  onUndo?: () => Promise<boolean>;
  snapshots?: ComparisonSnapshot[];
  initialCanUndo?: boolean;
}) {
  const [promotedIds, setPromotedIds] = useState<Set<string>>(() => new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const pendingIdsRef = useRef(new Set<string>());
  const operationQueue = useRef<Promise<void>>(Promise.resolve());
  const [error, setError] = useState<string | null>(null);
  const [snapshotSaved, setSnapshotSaved] = useState(false);
  const [snapshotName, setSnapshotName] = useState("本轮对比");
  const [openSnapshotId, setOpenSnapshotId] = useState<string>();
  const [canUndo, setCanUndo] = useState(initialCanUndo);
  // Finalization is unlocked only by records read back from persistence. Optimistic
  // selections stay visible, but cannot open finalization before their writes finish.
  const finalistCount = finalists.length;
  const visibleFinalists = [
    ...finalists,
    ...candidates.filter(
      (candidate) =>
        promotedIds.has(candidate.id) &&
        !finalists.some((finalist) => finalist.id === candidate.id),
    ),
  ];
  const openSnapshot = snapshots.find((snapshot) => snapshot.id === openSnapshotId);

  useEffect(() => {
    setPromotedIds((current) => {
      const next = new Set(
        [...current].filter((id) => !finalists.some((candidate) => candidate.id === id)),
      );
      return next.size === current.size ? current : next;
    });
  }, [finalists]);

  async function promote(candidate: FunnelCandidate) {
    if (pendingIdsRef.current.has(candidate.id) || promotedIds.has(candidate.id)) return;
    pendingIdsRef.current.add(candidate.id);
    setPendingIds(new Set(pendingIdsRef.current));
    setError(null);
    const operation = operationQueue.current.then(() => onPromote(candidate.id));
    operationQueue.current = operation.catch(() => undefined);
    try {
      await operation;
      setPromotedIds((current) => new Set(current).add(candidate.id));
      setCanUndo(true);
    } catch {
      setError(`未能将${candidate.fullName}列为最终候选，请重试。`);
    } finally {
      pendingIdsRef.current.delete(candidate.id);
      setPendingIds(new Set(pendingIdsRef.current));
    }
  }

  return (
    <main className="comparison-page">
      <header>
        <p className="project-center__kicker">CANDIDATE COMPARISON</p>
        <h1>候选对比</h1>
        <p>并排查看出处、寓意、风险和个人评分，从中选出 3–5 个最终候选。</p>
      </header>
      {onSaveSnapshot && candidates.length >= 2 ? (
        <div>
          <label>
            快照名称
            <input
              aria-label="快照名称"
              maxLength={80}
              onChange={(event) => setSnapshotName(event.target.value)}
              value={snapshotName}
            />
          </label>
          <Button
            disabled={!snapshotName.trim()}
            onClick={() =>
              void onSaveSnapshot(candidates.slice(0, 5), snapshotName.trim())
                .then(() => setSnapshotSaved(true))
                .catch(() => setError("快照保存失败，请重试"))
            }
            type="button"
          >
            保存对比快照
          </Button>
        </div>
      ) : null}
      {snapshotSaved ? <p role="status">对比快照已保存</p> : null}
      {snapshots.length > 0 ? (
        <section aria-label="历史对比快照">
          <h2>历史对比</h2>
          {snapshots.map((snapshot) => (
            <button
              key={snapshot.id}
              onClick={() => setOpenSnapshotId(snapshot.id)}
              type="button"
            >
              查看{snapshot.name}
            </button>
          ))}
        </section>
      ) : null}
      {onUndo && canUndo ? (
        <Button
          onClick={() =>
            void onUndo().then((hasMore) => {
              setCanUndo(hasMore);
              setPromotedIds((current) => {
                const next = new Set(current);
                const latest = [...next].at(-1);
                if (latest) next.delete(latest);
                return next;
              });
            })
          }
          type="button"
        >
          撤销上一步
        </Button>
      ) : null}
      {onOpenFinalization && finalistCount >= 3 && finalistCount <= 5 ? (
        <Button onClick={onOpenFinalization} type="button">
          进入最终定稿
        </Button>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      {visibleFinalists.length > 0 ? (
        <section aria-label="已选最终候选" className="comparison-page__finalists">
          <div>
            <p className="project-center__kicker">FINALISTS</p>
            <h2>已选最终候选 {finalistCount} / 5</h2>
            <p>这些名字已经保存。刷新或重新进入页面仍会显示，可随时移回对比。</p>
          </div>
          <div className="comparison-page__finalist-list">
            {visibleFinalists.map((candidate) => (
              <article key={candidate.id}>
                <strong>{candidate.fullName}</strong>
                <span>{candidate.summary}</span>
                {onReturnToComparison && finalists.some((item) => item.id === candidate.id) ? (
                  <button
                    disabled={pendingIds.has(candidate.id)}
                    onClick={() => {
                      if (pendingIdsRef.current.has(candidate.id)) return;
                      pendingIdsRef.current.add(candidate.id);
                      setPendingIds(new Set(pendingIdsRef.current));
                      setError(null);
                      const operation = operationQueue.current.then(() =>
                        onReturnToComparison(candidate.id),
                      );
                      operationQueue.current = operation.catch(() => undefined);
                      void operation
                        .then(() => setCanUndo(true))
                        .catch(() => setError(`未能将${candidate.fullName}移回对比，请重试。`))
                        .finally(() => {
                          pendingIdsRef.current.delete(candidate.id);
                          setPendingIds(new Set(pendingIdsRef.current));
                        });
                    }}
                    type="button"
                  >
                    移回对比
                  </button>
                ) : (
                  <span className="ui-status">已选</span>
                )}
              </article>
            ))}
          </div>
        </section>
      ) : null}
      {candidates.length === 0 ? (
        <Card className="comparison-page__empty">
          {visibleFinalists.length > 0
            ? "待比较列表已处理完。上方最终候选仍然完整保存，可以继续定稿或移回对比。"
            : "请回到“生名与初选”，在“我的候选”中把至少 2 个名字加入对比。"}
        </Card>
      ) : (
        <section className="comparison-page__grid">
          {candidates.slice(0, 5).map((candidate) => (
            <Card className="comparison-column" key={candidate.id}>
              <h2>{candidate.fullName}</h2>
              <dl>
                <dt>来源</dt>
                <dd>{formatSource(candidate)}</dd>
                <dt>读音</dt>
                <dd>{candidate.pinyin.join(" · ") || "待人工确认"}</dd>
                <dt>字形</dt>
                <dd>
                  {candidate.ruleEvidence?.find((rule) => rule.ruleId === "l3-shape-balance")
                    ?.explanation ?? "待数据"}
                </dd>
                <dt>寓意</dt>
                <dd>{candidate.summary}</dd>
                <dt>系统匹配</dt>
                <dd>{candidate.systemScore ?? 0}/100</dd>
                <dt>扣分明细</dt>
                <dd>{formatDeductions(candidate.ruleEvidence)}</dd>
                <dt>L3 偏好</dt>
                <dd>
                  {candidate.ruleEvidence
                    ?.filter(
                      (rule) =>
                        rule.evidenceLevel === "L3" && rule.ruleId !== "l3-shape-balance",
                    )
                    .map((rule) => rule.explanation)
                    .join("；") || "待数据"}
                </dd>
                {candidate.ruleEvidence?.some((rule) => rule.evidenceLevel === "L4") ? (
                  <>
                    <dt>L4 民俗参考</dt>
                    <dd>
                      {candidate.ruleEvidence
                        .filter((rule) => rule.evidenceLevel === "L4")
                        .map((rule) => rule.explanation)
                        .join("；")}
                    </dd>
                  </>
                ) : null}
                <dt>个人评分</dt>
                <dd>{candidate.rating ? `${candidate.rating} 分` : "未评分"}</dd>
                <dt>备注</dt>
                <dd>{candidate.note || "无"}</dd>
                <dt>风险</dt>
                <dd>
                  {candidate.warnings.map((warning) => warning.explanation).join("；") ||
                    "当前无明显风险"}
                </dd>
              </dl>
              <Button
                disabled={
                  pendingIds.has(candidate.id) ||
                  promotedIds.has(candidate.id) ||
                  finalistCount >= 5
                }
                onClick={() => void promote(candidate)}
                type="button"
              >
                {promotedIds.has(candidate.id)
                  ? `${candidate.fullName}已列为最终候选`
                  : pendingIds.has(candidate.id)
                    ? `正在处理${candidate.fullName}`
                    : `将${candidate.fullName}列为最终候选`}
              </Button>
            </Card>
          ))}
        </section>
      )}
      {openSnapshot ? (
        <Dialog title={openSnapshot.name} onClose={() => setOpenSnapshotId(undefined)}>
          <p>保存于 {new Date(openSnapshot.createdAt).toLocaleString("zh-CN")}</p>
          {openSnapshot.candidates.map((candidate) => (
            <section key={candidate.id}>
              <h3>{candidate.fullName}</h3>
              <ComparisonEvidence candidate={candidate} />
            </section>
          ))}
          <button onClick={() => setOpenSnapshotId(undefined)} type="button">
            关闭历史快照
          </button>
        </Dialog>
      ) : null}
    </main>
  );
}

function ComparisonEvidence({ candidate }: { candidate: ComparisonSnapshotCandidate }) {
  const shape = candidate.ruleEvidence.find((rule) => rule.ruleId === "l3-shape-balance");
  const l3 = candidate.ruleEvidence.filter(
    (rule) => rule.evidenceLevel === "L3" && rule.ruleId !== "l3-shape-balance",
  );
  const l4 = candidate.ruleEvidence.filter((rule) => rule.evidenceLevel === "L4");
  return (
    <dl>
      <dt>来源</dt>
      <dd>{formatSource(candidate)}</dd>
      <dt>读音</dt>
      <dd>{candidate.pinyin.join(" · ") || "待人工确认"}</dd>
      <dt>字形</dt>
      <dd>{shape?.explanation ?? "待数据"}</dd>
      <dt>寓意</dt>
      <dd>{candidate.summary}</dd>
      <dt>系统匹配</dt>
      <dd>{calculateSystemScore(candidate.ruleEvidence)}/100</dd>
      <dt>扣分明细</dt>
      <dd>{formatDeductions(candidate.ruleEvidence)}</dd>
      <dt>L3 偏好</dt>
      <dd>{l3.map((rule) => rule.explanation).join("；") || "待数据"}</dd>
      {l4.length > 0 ? (
        <>
          <dt>L4 民俗参考</dt>
          <dd>{l4.map((rule) => rule.explanation).join("；")}</dd>
        </>
      ) : null}
      <dt>个人评分</dt>
      <dd>{candidate.rating ? `${candidate.rating} 分` : "未评分"}</dd>
      <dt>备注</dt>
      <dd>{candidate.note || "无"}</dd>
      <dt>风险</dt>
      <dd>
        {candidate.warnings.map((warning) => warning.explanation).join("；") ||
          "当前无明显风险"}
      </dd>
    </dl>
  );
}

function formatDeductions(
  rules: ReadonlyArray<{ explanation: string; scoreDelta?: number | undefined }>,
): string {
  const deductions = rules.filter((rule) => (rule.scoreDelta ?? 0) < 0);
  return deductions.length
    ? deductions.map((rule) => `${rule.explanation}（${rule.scoreDelta}）`).join("；")
    : "当前评分没有扣分项";
}

const sourceLabels = {
  verified_allusion: "古籍取名",
  modern_combination: "现代组合",
  user_input: "用户录入",
} as const;

function formatSource(candidate: FunnelCandidate | ComparisonSnapshotCandidate): string {
  const source = (candidate.sourceEvidence ?? [])
    .map((item) =>
      [item.work ?? item.title, item.quote ?? item.excerpt, item.location]
        .filter(Boolean)
        .join(" · "),
    )
    .filter(Boolean)
    .join("；");
  return source || sourceLabels[candidate.sourceType];
}
