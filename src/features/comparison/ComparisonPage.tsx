import { Dialog } from "../../design-system/primitives/Dialog";
import { Card } from "../../design-system/primitives/Card";
import { Button } from "../../design-system/primitives/Button";
import { useEffect, useRef, useState } from "react";
import type { CandidateFunnelItem as FunnelCandidate } from "../../application/models/CandidateFunnelItem";
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
  onBackToCandidates,
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
  onBackToCandidates?: () => void;
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
  const comparedCandidates = candidates.slice(0, 5);
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
      setError(`未能将${candidate.fullName}加入定稿名单，请重试。`);
    } finally {
      pendingIdsRef.current.delete(candidate.id);
      setPendingIds(new Set(pendingIdsRef.current));
    }
  }

  return (
    <main className="comparison-page">
      <header>
        <p className="project-center__kicker">CANDIDATE COMPARISON</p>
        <h1>重点候选</h1>
        <p>并排查看出处、寓意、风险和个人评分，可将 1–5 个名字加入定稿名单。</p>
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
      {onOpenFinalization && finalistCount >= 1 && finalistCount <= 5 ? (
        <Button onClick={onOpenFinalization} type="button">
          查看定稿名单
        </Button>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      {visibleFinalists.length > 0 ? (
        <section aria-label="定稿名单" className="comparison-page__finalists">
          <div>
            <p className="project-center__kicker">FINAL LIST</p>
            <h2>定稿名单 {finalistCount} / 5</h2>
            <p>名单可以保留多个名字；可随时移回重点候选继续比较。</p>
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
                        .catch(() =>
                          setError(`未能将${candidate.fullName}移回重点候选，请重试。`),
                        )
                        .finally(() => {
                          pendingIdsRef.current.delete(candidate.id);
                          setPendingIds(new Set(pendingIdsRef.current));
                        });
                    }}
                    type="button"
                  >
                    移除到重点候选
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
          <p>
            {visibleFinalists.length > 0
              ? "重点候选已处理完。上方定稿名单仍然完整保存，可继续调整。"
              : "请回到基础候选或民俗候选，至少加入 1 个重点候选。"}
          </p>
          {visibleFinalists.length === 0 && onBackToCandidates ? (
            <Button onClick={onBackToCandidates} type="button">
              返回我的候选
            </Button>
          ) : null}
        </Card>
      ) : (
        <>
          <div
            className="comparison-page__mobile-table"
            aria-label="重点候选同属性比较"
            role="region"
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">属性</th>
                  {comparedCandidates.map((candidate) => (
                    <th key={candidate.id} scope="col">
                      {candidate.fullName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["来源", (candidate: FunnelCandidate) => formatProvenance(candidate)],
                  [
                    "读音",
                    (candidate: FunnelCandidate) =>
                      candidate.pinyin.join(" · ") || "待人工确认",
                  ],
                  ["寓意", (candidate: FunnelCandidate) => candidate.summary],
                  [
                    "排序分",
                    (candidate: FunnelCandidate) =>
                      `${candidate.systemScore ?? calculateSystemScore(candidate.ruleEvidence ?? [])}/100`,
                  ],
                  [
                    "民俗筛选",
                    (candidate: FunnelCandidate) =>
                      candidate.folkloreReviewed ? "已复筛" : "未复筛",
                  ],
                  ["使用提醒", (candidate: FunnelCandidate) => formatUsageNotes(candidate)],
                ].map(([label, value]) => (
                  <tr key={String(label)}>
                    <th scope="row">{String(label)}</th>
                    {comparedCandidates.map((candidate) => (
                      <td key={candidate.id}>
                        {(value as (item: FunnelCandidate) => string)(candidate)}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <th scope="row">操作</th>
                  {comparedCandidates.map((candidate) => (
                    <td key={candidate.id}>
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
                          ? `${candidate.fullName}已加入定稿名单`
                          : `加入定稿名单`}
                      </Button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <section className="comparison-page__grid">
            {comparedCandidates.map((candidate) => (
              <Card className="comparison-column" key={candidate.id}>
                <h2>{candidate.fullName}</h2>
                <dl>
                  <dt>来源与出处</dt>
                  <dd>{formatProvenance(candidate)}</dd>
                  <dt>读音与叫名</dt>
                  <dd>{candidate.pinyin.join(" · ") || "待人工确认"}</dd>
                  <dt>寓意</dt>
                  <dd>{candidate.summary}</dd>
                  <dt>系统匹配</dt>
                  <dd>
                    {candidate.systemScore ??
                      calculateSystemScore(candidate.ruleEvidence ?? [])}
                    /100
                  </dd>
                  <dt>扣分明细</dt>
                  <dd>{formatDeductions(candidate.ruleEvidence ?? [])}</dd>
                  <dt>个人评分</dt>
                  <dd>{candidate.rating ? `${candidate.rating} 分` : "未评分"}</dd>
                  <dt>备注</dt>
                  <dd>{candidate.note || "无"}</dd>
                  <dt>使用提醒</dt>
                  <dd>{formatUsageNotes(candidate)}</dd>
                  <dt>民俗筛选</dt>
                  <dd>{candidate.folkloreReviewed ? "已复筛" : "未复筛"}</dd>
                </dl>
                <TechnicalEvidence candidate={candidate} />
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
                    ? `${candidate.fullName}已加入定稿名单`
                    : pendingIds.has(candidate.id)
                      ? `正在处理${candidate.fullName}`
                      : `将${candidate.fullName}加入定稿名单`}
                </Button>
              </Card>
            ))}
          </section>
        </>
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
  return (
    <>
      <dl>
        <dt>来源与出处</dt>
        <dd>{formatProvenance(candidate)}</dd>
        <dt>读音与叫名</dt>
        <dd>{candidate.pinyin.join(" · ") || "待人工确认"}</dd>
        <dt>寓意</dt>
        <dd>{candidate.summary}</dd>
        <dt>系统匹配</dt>
        <dd>{calculateSystemScore(candidate.ruleEvidence)}/100</dd>
        <dt>扣分明细</dt>
        <dd>{formatDeductions(candidate.ruleEvidence)}</dd>
        <dt>个人评分</dt>
        <dd>{candidate.rating ? `${candidate.rating} 分` : "未评分"}</dd>
        <dt>备注</dt>
        <dd>{candidate.note || "无"}</dd>
        <dt>使用提醒</dt>
        <dd>{formatUsageNotes(candidate)}</dd>
      </dl>
      <TechnicalEvidence candidate={candidate} />
    </>
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

function formatProvenance(candidate: FunnelCandidate | ComparisonSnapshotCandidate): string {
  if (candidate.sourceType === "modern_combination") return "现代组合 · 尔雅独立整理";
  const source = (candidate.sourceEvidence ?? [])
    .filter((item) => item.sourceId !== "erya-modern-20260927")
    .map((item) =>
      [item.work ?? item.title, item.quote ?? item.excerpt, item.location]
        .filter(Boolean)
        .join(" · "),
    )
    .filter(Boolean)
    .join("；");
  return source || sourceLabels[candidate.sourceType];
}

function formatUsageNotes(candidate: FunnelCandidate | ComparisonSnapshotCandidate): string {
  const notes = [
    ...(candidate.usageNotes ??
      (candidate.sourceEvidence ?? [])
        .filter((item) => item.sourceId === "erya-modern-20260927")
        .flatMap((item) => (item.excerpt ? [item.excerpt] : []))),
    ...candidate.warnings.map((warning) => warning.explanation),
  ];
  return (
    [...new Set(notes)].join("；") || "当前未发现明显风险，仍建议结合方言和真实使用场景确认。"
  );
}

function TechnicalEvidence({
  candidate,
}: {
  candidate: FunnelCandidate | ComparisonSnapshotCandidate;
}) {
  const shape = candidate.ruleEvidence?.find((rule) => rule.ruleId === "l3-shape-balance");
  const preferences = candidate.ruleEvidence
    ?.filter(
      (rule) =>
        rule.evidenceLevel === "L3" &&
        rule.ruleId !== "l3-shape-balance" &&
        !rule.explanation.startsWith("当前数据包没有"),
    )
    .map((rule) => rule.explanation);
  const folklore = candidate.ruleEvidence
    ?.filter((rule) => rule.evidenceLevel === "L4")
    .map((rule) => rule.explanation);
  if (!shape && !preferences?.length && !folklore?.length) return null;
  return (
    <details>
      <summary>查看评分与技术依据</summary>
      <dl>
        {shape ? (
          <>
            <dt>书写难度</dt>
            <dd>{shape.explanation}</dd>
          </>
        ) : null}
        {preferences?.length ? (
          <>
            <dt>风格与使用匹配</dt>
            <dd>{preferences.join("；")}</dd>
          </>
        ) : null}
        {folklore?.length ? (
          <>
            <dt>传统民俗参考</dt>
            <dd>{folklore.join("；")}</dd>
          </>
        ) : null}
      </dl>
    </details>
  );
}
