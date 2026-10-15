import { useEffect, useMemo, useState, useRef, type ReactNode } from "react";
import { Button } from "../../design-system/primitives/Button";
import { Dialog } from "../../design-system/primitives/Dialog";
import type { CandidateFunnelItem } from "../../application/models/CandidateFunnelItem";
import type { NamingProfile } from "../../domain/project/profile";
import { AddManualCandidateDialog } from "./AddManualCandidateDialog";
import { CandidateCard } from "./CandidateCard";
import { cardLevelWarnings } from "./warningVisibility";
import { NameExplanation } from "../insights/NameExplanation";
import "./candidate-funnel.css";
export type FunnelCandidate = CandidateFunnelItem;
export type FunnelStageView = "inbox" | "basic" | "folklore" | "excluded";
export interface FunnelFocusRequest {
  candidateId?: string | undefined;
  requestId: number;
  stage: FunnelStageView;
}

const isInBasicPool = (item: FunnelCandidate) =>
  ["basic_shortlist", "folklore_review", "favorite", "comparison", "finalist"].includes(
    item.stage,
  );

const isInFolklorePool = (item: FunnelCandidate) =>
  item.stage === "folklore_review" ||
  (Boolean(item.folkloreReviewed) && ["comparison", "finalist"].includes(item.stage));

export function CandidateFunnelPage({
  candidates,
  onFavorite,
  onMove,
  onEvaluate,
  onOpenComparison,
  onUndo,
  onAddManual,
  sessionKey,
  initialCanUndo = false,
  profile,
  embedded = false,
  initialStage,
  onStageChange,
  progressionBlocked = false,
  onResolveConstraints,
  onApplyAutoFilter,
  generationControls,
  focusRequest,
  folkloreControls,
  onGenerateMore,
  generationBusy = false,
  latestGeneratedBatchId,
}: {
  candidates: FunnelCandidate[];
  onFavorite: (id: string) => Promise<void>;
  onMove?: (
    id: string,
    stage: "inbox" | "basic_shortlist" | "folklore_review" | "comparison" | "excluded",
    reason?: string,
  ) => Promise<void>;
  onEvaluate?: (id: string, rating: number, note: string) => Promise<void>;
  onOpenComparison?: () => void;
  onUndo?: () => Promise<boolean>;
  onAddManual?: (input: {
    fullName: string;
    userSource: string;
    meaning: string;
  }) => Promise<void>;
  sessionKey?: string;
  initialCanUndo?: boolean;
  profile?: NamingProfile | undefined;
  embedded?: boolean;
  initialStage?: FunnelStageView;
  onStageChange?: (stage: FunnelStageView) => void;
  progressionBlocked?: boolean;
  onResolveConstraints?: () => void;
  onApplyAutoFilter?: (input: {
    moves: Array<{
      candidateId: string;
      from: "basic_shortlist" | "folklore_review";
      to: "inbox" | "basic_shortlist";
      expectedUpdatedAt: string;
    }>;
  }) => Promise<void>;
  generationControls?: ReactNode;
  focusRequest?: FunnelFocusRequest | undefined;
  folkloreControls?: ReactNode;
  onGenerateMore?: () => Promise<void>;
  generationBusy?: boolean;
  latestGeneratedBatchId?: string | undefined;
}) {
  const key = sessionKey ? `erya-names:studio:${sessionKey}` : undefined;
  const [restored] = useState(() => {
    try {
      const value = key ? sessionStorage.getItem(key) : null;
      if (!value) return {};
      if (["inbox", "basic", "folklore", "excluded"].includes(value)) return { stage: value };
      if (value === "shortlist") return { stage: "basic" };
      if (value === "rejected") return { stage: "excluded" };
      return JSON.parse(value) as Record<string, string>;
    } catch {
      return {};
    }
  });
  const [stage, setStage] = useState<FunnelStageView>(
    initialStage ?? (restored.stage as FunnelStageView | undefined) ?? "inbox",
  );
  const [query, setQuery] = useState(restored.query ?? "");
  const [source, setSource] = useState(restored.source ?? "all");
  const [risk, setRisk] = useState(restored.risk ?? "all");
  const [style, setStyle] = useState(restored.style ?? "all");
  const [sort, setSort] = useState(restored.sort ?? "score");
  const [onlyLatestBatch, setOnlyLatestBatch] = useState(false);
  useEffect(() => {
    try {
      if (key)
        sessionStorage.setItem(
          key,
          JSON.stringify({ stage, query, source, risk, style, sort }),
        );
    } catch {
      /* Local filters remain usable when session persistence is unavailable. */
    }
  }, [key, stage, query, source, risk, style, sort]);
  useEffect(() => {
    if (initialStage) setStage(initialStage);
  }, [initialStage]);
  const [limit, setLimit] = useState(9);
  const [detailId, setDetailId] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState("");
  const [canUndo, setCanUndo] = useState(initialCanUndo);
  const [showAutoFilterPreview, setShowAutoFilterPreview] = useState(false);
  const [optimistic, setOptimistic] = useState<Record<string, FunnelCandidate["stage"]>>({});
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const pendingCount = useRef(0);
  const evaluationDrafts = useRef<Record<string, { rating: number; note: string }>>({});
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const stageTitleRef = useRef<HTMLHeadingElement>(null);
  const resultStatusRef = useRef<HTMLSpanElement>(null);
  const items = useMemo(
    () =>
      candidates.map((item) =>
        optimistic[item.id] ? { ...item, stage: optimistic[item.id]! } : item,
      ),
    [candidates, optimistic],
  );
  const comparisonCount = items.filter((item) => item.stage === "comparison").length;
  const basicPendingCount = items.filter((item) =>
    ["basic_shortlist", "favorite"].includes(item.stage),
  ).length;
  const batchItems = items.filter((item) => item.batchId);
  const mostRecentBatchId = batchItems.some((item) => item.createdAt)
    ? [...batchItems].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))[0]
        ?.batchId
    : [...batchItems].reverse()[0]?.batchId;
  const activeBatchId = latestGeneratedBatchId ?? mostRecentBatchId;
  const hasMultipleBatches = Boolean(
    activeBatchId && items.some((item) => item.batchId && item.batchId !== activeBatchId),
  );
  const filtered = useMemo(
    () =>
      items
        .filter((item) => {
          const matchesStage =
            stage === "basic"
              ? isInBasicPool(item)
              : stage === "folklore"
                ? isInFolklorePool(item)
                : stage === "excluded"
                  ? item.stage === "excluded" || item.stage === "rejected"
                  : item.stage === "inbox";
          if (!matchesStage) return false;
          if (source !== "all" && item.sourceType !== source) return false;
          const visibleWarnings = cardLevelWarnings(item);
          if (risk === "without-risk" && visibleWarnings.length) return false;
          if (risk === "with-risk" && !visibleWarnings.length) return false;
          if (style !== "all" && !item.styleTags?.includes(style)) return false;
          if (
            stage === "inbox" &&
            onlyLatestBatch &&
            activeBatchId &&
            item.batchId !== activeBatchId
          )
            return false;
          const search = query.trim().toLowerCase();
          return (
            !search ||
            `${item.fullName} ${item.summary} ${item.pinyin.join(" ")}`
              .toLowerCase()
              .includes(search)
          );
        })
        .sort((a, b) => {
          const basicStageOrder = (item: FunnelCandidate) =>
            ["basic_shortlist", "favorite"].includes(item.stage) ? 0 : 1;
          const stageDifference =
            stage === "basic" ? basicStageOrder(a) - basicStageOrder(b) : 0;
          if (stageDifference) return stageDifference;
          return sort === "rating"
            ? (ratings[b.id] ?? b.rating ?? 0) - (ratings[a.id] ?? a.rating ?? 0)
            : sort === "name"
              ? a.fullName.localeCompare(b.fullName, "zh-CN")
              : (b.systemScore ?? 0) - (a.systemScore ?? 0);
        }),
    [items, stage, source, risk, style, query, sort, ratings, onlyLatestBatch, activeBatchId],
  );
  useEffect(() => setLimit(9), [stage, query, source, risk, style, onlyLatestBatch]);
  useEffect(() => setShowAutoFilterPreview(false), [stage, query, source, risk, style]);
  useEffect(() => {
    if (!latestGeneratedBatchId) return;
    setOnlyLatestBatch(true);
    setLimit(9);
    requestAnimationFrame(() => {
      const target = resultStatusRef.current;
      target?.scrollIntoView?.({
        behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
          ? "auto"
          : "smooth",
        block: "start",
      });
      target?.focus();
    });
  }, [latestGeneratedBatchId]);
  const changeStage = (value: FunnelStageView) => {
    setStage(value);
    onStageChange?.(value);
  };
  useEffect(() => {
    if (!focusRequest) return;
    changeStage(focusRequest.stage);
    setQuery("");
    setSource("all");
    setRisk("all");
    setStyle("all");
    setOnlyLatestBatch(false);
    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        const candidateNode = focusRequest.candidateId
          ? [...document.querySelectorAll<HTMLElement>("[data-candidate-id]")].find(
              (element) => element.dataset.candidateId === focusRequest.candidateId,
            )
          : undefined;
        candidateNode?.scrollIntoView({
          behavior: prefersReducedMotion ? "auto" : "smooth",
          block: "center",
        });
        const focusTarget =
          candidateNode?.querySelector<HTMLElement>("button:not([disabled])") ??
          candidateNode?.querySelector<HTMLElement>(
            "input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
          );
        (focusTarget ?? stageTitleRef.current)?.focus();
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
    };
  }, [focusRequest]);
  const run = async (id: string, action: () => Promise<void>) => {
    pendingCount.current++;
    setBusy(id);
    setError("");
    const task = saveQueue.current.then(action);
    saveQueue.current = task.catch(() => {});
    try {
      await task;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "操作失败，请重试");
    } finally {
      pendingCount.current--;
      if (pendingCount.current === 0) setBusy(undefined);
    }
  };
  const saveEvaluation = (item: FunnelCandidate, rating: number, note: string) => {
    evaluationDrafts.current[item.id] = { rating, note };
    setRatings((current) => ({ ...current, [item.id]: rating }));
    void run(item.id, async () => {
      const latest = evaluationDrafts.current[item.id]!;
      await onEvaluate?.(item.id, latest.rating, latest.note);
    });
  };
  const move = async (
    item: FunnelCandidate,
    to: "inbox" | "basic_shortlist" | "folklore_review" | "comparison" | "excluded",
  ) => {
    const visibleIds = filtered.map((candidate) => candidate.id);
    await run(item.id, async () => {
      if (to === "basic_shortlist" && item.stage === "inbox") await onFavorite(item.id);
      else
        await onMove?.(
          item.id,
          to,
          to === "excluded" ? reasons[item.id] || "暂不考虑" : undefined,
        );
      setOptimistic((current) => ({ ...current, [item.id]: to }));
      setCanUndo(true);
    });
    const currentIndex = visibleIds.indexOf(item.id);
    const nextId = visibleIds[currentIndex + 1] ?? visibleIds[currentIndex - 1];
    requestAnimationFrame(() => {
      const nextCard = nextId
        ? [...document.querySelectorAll<HTMLElement>("[data-candidate-id]")].find(
            (element) => element.dataset.candidateId === nextId,
          )
        : undefined;
      const target = nextCard?.querySelector<HTMLElement>("button");
      (target ?? stageTitleRef.current)?.focus();
    });
  };
  const detail = items.find((item) => item.id === detailId);
  const automaticKeepCount = stage === "basic" ? 5 : 3;
  const autoFilterPool = ["basic", "folklore"].includes(stage)
    ? items
        .filter((item) =>
          stage === "basic"
            ? item.stage === "basic_shortlist" || item.stage === "favorite"
            : item.stage === "folklore_review",
        )
        .sort((a, b) => {
          const folkloreDelta = (item: FunnelCandidate) =>
            (item.ruleEvidence ?? [])
              .filter((rule) => rule.evidenceLevel === "L4")
              .reduce((sum, rule) => sum + (rule.scoreDelta ?? 0), 0);
          const folkloreDifference =
            stage === "folklore" ? folkloreDelta(b) - folkloreDelta(a) : 0;
          return (
            folkloreDifference ||
            (b.systemScore ?? 0) - (a.systemScore ?? 0) ||
            a.fullName.localeCompare(b.fullName, "zh-CN")
          );
        })
    : [];
  const automaticallyRemoved = ["basic", "folklore"].includes(stage)
    ? autoFilterPool.slice(automaticKeepCount)
    : [];
  const automaticTarget = stage === "basic" ? "inbox" : "basic_shortlist";
  const body = (
    <>
      {!embedded ? (
        <header>
          <p className="eyebrow">选名书斋</p>
          <h1>生名与初选</h1>
          <p>先浏览灵感，再将喜欢的名字收入候选。</p>
        </header>
      ) : null}
      <div className="studio-section-heading">
        <h2 ref={stageTitleRef} tabIndex={-1}>
          把喜欢的名字，慢慢留下
        </h2>
        <span>已保存 {items.length} 个名字</span>
      </div>
      {stage === "inbox" ? generationControls : null}
      <nav className="studio-tabs" aria-label="选名阶段">
        {[
          ["inbox", "灵感池", items.filter((x) => x.stage === "inbox").length],
          ["basic", "基础候选", items.filter(isInBasicPool).length],
          ["folklore", "民俗候选", items.filter(isInFolklorePool).length],
          [
            "excluded",
            "已排除",
            items.filter((x) => ["excluded", "rejected"].includes(x.stage)).length,
          ],
        ].map(([value, label, count]) => (
          <button
            type="button"
            key={value}
            aria-pressed={stage === value}
            onClick={() => changeStage(String(value) as FunnelStageView)}
          >
            {label}
            <span>{count}</span>
          </button>
        ))}
      </nav>
      {stage === "basic" ? (
        <section className="studio-stage-guide" aria-label="基础候选下一步">
          <strong>待决定 {basicPendingCount} 个名字</strong>
          <span>可进入民俗候选继续参考，或跳过民俗直接加入重点候选。</span>
        </section>
      ) : null}
      {stage === "folklore" ? folkloreControls : null}
      <div className="studio-filterbar">
        <label className="studio-search">
          搜索名字或寓意
          <input
            aria-label="搜索姓名"
            placeholder="试试：清、温润、星辰…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label>
          来源
          <select
            aria-label="筛选来源"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="all">全部来源</option>
            <option value="verified_allusion">古籍取名</option>
            <option value="modern_combination">字义组合</option>
            <option value="user_input">手工录入</option>
          </select>
        </label>
        <label>
          使用提示
          <select aria-label="筛选风险" value={risk} onChange={(e) => setRisk(e.target.value)}>
            <option value="all">全部名字</option>
            <option value="without-risk">未发现明显风险</option>
            <option value="with-risk">有待留意项</option>
          </select>
        </label>
        <label>
          风格
          <select
            aria-label="筛选风格"
            value={style}
            onChange={(e) => setStyle(e.target.value)}
          >
            <option value="all">全部风格</option>
            {[...new Set(items.flatMap((x) => x.styleTags ?? []))].map((tag) => (
              <option key={tag}>{tag}</option>
            ))}
          </select>
        </label>
        <label>
          排序
          <select aria-label="候选排序" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="score">系统匹配分</option>
            <option value="rating">个人评分</option>
            <option value="name">姓名顺序</option>
          </select>
        </label>
        {stage === "inbox" && hasMultipleBatches ? (
          <div className="studio-batch-switch" role="group" aria-label="灵感范围">
            <span>灵感范围</span>
            <button
              aria-pressed={onlyLatestBatch}
              onClick={() => setOnlyLatestBatch(true)}
              type="button"
            >
              最新一批
            </button>
            <button
              aria-pressed={!onlyLatestBatch}
              onClick={() => setOnlyLatestBatch(false)}
              type="button"
            >
              全部灵感
            </button>
          </div>
        ) : null}
      </div>
      <div className="studio-toolbar">
        <span ref={resultStatusRef} role="status" tabIndex={-1}>
          筛选结果 {filtered.length} 条，当前显示 {Math.min(limit, filtered.length)} 条
        </span>
        <div>
          {onUndo ? (
            <button
              type="button"
              disabled={!canUndo || Boolean(busy)}
              onClick={() =>
                void run("undo", async () => {
                  setCanUndo(await onUndo());
                  setOptimistic({});
                })
              }
            >
              撤销上一步
            </button>
          ) : null}
          {["basic", "folklore"].includes(stage) && onOpenComparison ? (
            <Button
              disabled={progressionBlocked || comparisonCount < 1}
              type="button"
              onClick={onOpenComparison}
            >
              {progressionBlocked
                ? "请先核对家庭规则"
                : comparisonCount < 1
                  ? "请先加入重点候选"
                  : "打开重点候选"}
            </Button>
          ) : null}
        </div>
      </div>
      {["basic", "folklore"].includes(stage) && autoFilterPool.length > 0 ? (
        <section className="paper-card" aria-label="自动筛选">
          <h3>自动筛选</h3>
          <p>
            {stage === "basic"
              ? "基础阶段固定按系统匹配分排序。"
              : "民俗阶段固定按当前民俗参考分，再按基础系统匹配分排序。"}
            结果不受当前排序下拉影响；确认后只移除到上一步，不会排除名字。
          </p>
          <button type="button" onClick={() => setShowAutoFilterPreview((current) => !current)}>
            {showAutoFilterPreview ? "收起自动筛选预览" : "预览自动筛选"}
          </button>
          {showAutoFilterPreview ? (
            <div role="status">
              <p>
                当前阶段预计保留前 {Math.min(automaticKeepCount, autoFilterPool.length)}{" "}
                个，移除 {automaticallyRemoved.length} 个到
                {stage === "basic" ? "灵感池" : "基础候选"}。
              </p>
              {automaticallyRemoved.length ? (
                <ul>
                  {automaticallyRemoved.map((item, index) => (
                    <li key={item.id}>
                      {item.fullName}：
                      {stage === "basic"
                        ? `系统匹配分 ${item.systemScore ?? 0}`
                        : `民俗软参考分 ${(item.ruleEvidence ?? [])
                            .filter((rule) => rule.evidenceLevel === "L4")
                            .reduce((sum, rule) => sum + (rule.scoreDelta ?? 0), 0)}`}
                      ，固定排序第 {automaticKeepCount + index + 1}，超出本阶段保留数
                    </li>
                  ))}
                </ul>
              ) : (
                <p>当前没有需要移除的名字。</p>
              )}
              <Button
                disabled={
                  busy !== undefined || automaticallyRemoved.length === 0 || !onApplyAutoFilter
                }
                type="button"
                onClick={() =>
                  void (async () => {
                    if (!onApplyAutoFilter) return;
                    await onApplyAutoFilter({
                      moves: automaticallyRemoved.map((item) => ({
                        candidateId: item.id,
                        from: stage === "basic" ? "basic_shortlist" : "folklore_review",
                        to: automaticTarget,
                        expectedUpdatedAt: item.decisionUpdatedAt ?? "missing-revision",
                      })),
                    });
                    setOptimistic((current) => ({
                      ...current,
                      ...Object.fromEntries(
                        automaticallyRemoved.map((item) => [item.id, automaticTarget]),
                      ),
                    }));
                    setShowAutoFilterPreview(false);
                    requestAnimationFrame(() => stageTitleRef.current?.focus());
                  })()
                }
              >
                确认应用本阶段筛选
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}
      {error ? (
        <p role="alert" className="onboarding__error">
          {error}
        </p>
      ) : null}
      {!filtered.length ? (
        <div className="studio-empty">
          <span aria-hidden="true">候</span>
          <h3>
            {items.length === 0
              ? "一份好名字，从一批灵感开始"
              : stage === "basic"
                ? "把心动的名字保留到基础候选"
                : stage === "folklore"
                  ? "从基础候选加入需要民俗参考的名字"
                  : "暂时没有符合条件的名字"}
          </h3>
          <p>
            {stage === "basic"
              ? "在灵感池点击“保留到基础候选”，再决定进入民俗候选或直接加入重点候选。"
              : stage === "folklore"
                ? "在基础候选点击“下一步：进入民俗候选”；民俗只提供传统参考，不替你淘汰名字。"
                : "可调整筛选条件，或在上方生成新的一批；历史记录会保留。"}
          </p>
          {query || source !== "all" || risk !== "all" || style !== "all" ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSource("all");
                setRisk("all");
                setStyle("all");
              }}
            >
              清除筛选条件
            </button>
          ) : null}
        </div>
      ) : null}
      <section className="candidate-funnel__grid" aria-label="名字列表">
        {filtered.slice(0, limit).map((item) => (
          <CandidateCard
            busy={Boolean(busy)}
            item={item}
            key={item.id}
            note={notes[item.id] ?? item.note ?? ""}
            onMove={(target) => void move(item, target)}
            onNoteChange={(value) => setNotes((current) => ({ ...current, [item.id]: value }))}
            onNoteCommit={(value) => {
              if (value !== item.note)
                saveEvaluation(
                  item,
                  evaluationDrafts.current[item.id]?.rating ??
                    ratings[item.id] ??
                    item.rating ??
                    3,
                  value,
                );
            }}
            onOpenDetail={() => setDetailId(item.id)}
            onRejectionReasonChange={(value) =>
              setReasons((current) => ({ ...current, [item.id]: value }))
            }
            onRatingChange={(value) =>
              saveEvaluation(item, value, notes[item.id] ?? item.note ?? "")
            }
            {...(ratings[item.id] !== undefined ? { rating: ratings[item.id] } : {})}
            rejectionReason={reasons[item.id] ?? ""}
            showFolklore={stage === "folklore"}
            progressionBlocked={progressionBlocked}
            {...(onResolveConstraints ? { onResolveConstraints } : {})}
          />
        ))}
      </section>
      {filtered.length > limit ? (
        <Button type="button" onClick={() => setLimit((n) => n + 9)}>
          {stage === "inbox" && !onlyLatestBatch ? "显示更多历史灵感" : "显示更多名字"}
        </Button>
      ) : null}
      {stage === "inbox" && filtered.length > 0 && onGenerateMore ? (
        <div className="studio-generate-more">
          <p>这一批看完了？可以留在这里继续寻找，已有灵感不会丢失。</p>
          <Button disabled={generationBusy} onClick={() => void onGenerateMore()} type="button">
            {generationBusy ? "正在寻名…" : "再生成一批"}
          </Button>
        </div>
      ) : null}
      {onAddManual ? (
        <div className="studio-manual">
          <p>已经想到一个名字？可手工录入，再查看规则与解释。</p>
          <AddManualCandidateDialog onAdd={onAddManual} />
        </div>
      ) : null}
      {detail ? (
        <Dialog title={`${detail.fullName}详情`} onClose={() => setDetailId(undefined)}>
          <button className="dialog-close" type="button" onClick={() => setDetailId(undefined)}>
            关闭详情
          </button>
          <NameExplanation
            candidate={detail}
            profile={profile}
            showFolklore={stage === "folklore"}
          />
          {detail.stage === "inbox" ? (
            <Button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => void move(detail, "basic_shortlist")}
            >
              保留到基础候选{detail.fullName}
            </Button>
          ) : (
            <span className="ui-status">
              {["excluded", "rejected"].includes(detail.stage) ? "已排除" : "已进入候选漏斗"}
            </span>
          )}
        </Dialog>
      ) : null}
    </>
  );
  return embedded ? (
    <section className="candidate-funnel candidate-funnel--embedded">{body}</section>
  ) : (
    <main className="candidate-funnel">{body}</main>
  );
}
