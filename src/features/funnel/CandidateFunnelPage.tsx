import { useEffect, useMemo, useState, useRef } from "react";
import { Button } from "../../design-system/primitives/Button";
import { Card } from "../../design-system/primitives/Card";
import { Dialog } from "../../design-system/primitives/Dialog";
import type { CandidateFunnelItem } from "../../application/models/CandidateFunnelItem";
import type { NamingProfile } from "../../domain/project/profile";
import { AddManualCandidateDialog } from "./AddManualCandidateDialog";
import { NameExplanation } from "../insights/NameExplanation";
import "./candidate-funnel.css";
export type FunnelCandidate = CandidateFunnelItem;
const labels = {
  verified_allusion: "古籍取名",
  modern_combination: "字义组合",
  user_input: "手工录入",
};
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
}: {
  candidates: FunnelCandidate[];
  onFavorite: (id: string) => Promise<void>;
  onMove?: (
    id: string,
    stage: "comparison" | "rejected" | "inbox",
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
}) {
  const key = sessionKey ? `erya-names:studio:${sessionKey}` : undefined;
  const [restored] = useState(() => {
    try {
      const value = key ? sessionStorage.getItem(key) : null;
      if (!value) return {};
      if (["inbox", "shortlist", "rejected"].includes(value)) return { stage: value };
      return JSON.parse(value) as Record<string, string>;
    } catch {
      return {};
    }
  });
  const [stage, setStage] = useState(restored.stage ?? "inbox");
  const [query, setQuery] = useState(restored.query ?? "");
  const [source, setSource] = useState(restored.source ?? "all");
  const [risk, setRisk] = useState(restored.risk ?? "all");
  const [style, setStyle] = useState(restored.style ?? "all");
  const [sort, setSort] = useState(restored.sort ?? "score");
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
  const [limit, setLimit] = useState(48);
  const [detailId, setDetailId] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState("");
  const [canUndo, setCanUndo] = useState(initialCanUndo);
  const [optimistic, setOptimistic] = useState<Record<string, FunnelCandidate["stage"]>>({});
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const pendingCount = useRef(0);
  const evaluationDrafts = useRef<Record<string, { rating: number; note: string }>>({});
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const items = useMemo(
    () =>
      candidates.map((item) =>
        optimistic[item.id] ? { ...item, stage: optimistic[item.id]! } : item,
      ),
    [candidates, optimistic],
  );
  const collection = (item: FunnelCandidate) =>
    ["favorite", "comparison", "finalist"].includes(item.stage);
  const filtered = useMemo(
    () =>
      items
        .filter((item) => {
          if (
            stage === "shortlist" ? !collection(item) : stage !== "all" && item.stage !== stage
          )
            return false;
          if (source !== "all" && item.sourceType !== source) return false;
          if (risk === "without-risk" && item.warnings.length) return false;
          if (risk === "with-risk" && !item.warnings.length) return false;
          if (style !== "all" && !item.styleTags?.includes(style)) return false;
          const search = query.trim().toLowerCase();
          return (
            !search ||
            `${item.fullName} ${item.summary} ${item.pinyin.join(" ")}`
              .toLowerCase()
              .includes(search)
          );
        })
        .sort((a, b) =>
          sort === "rating"
            ? (ratings[b.id] ?? b.rating ?? 0) - (ratings[a.id] ?? a.rating ?? 0)
            : sort === "name"
              ? a.fullName.localeCompare(b.fullName, "zh-CN")
              : (b.systemScore ?? 0) - (a.systemScore ?? 0),
        ),
    [items, stage, source, risk, style, query, sort, ratings],
  );
  useEffect(() => setLimit(48), [stage, query, source, risk, style]);
  const changeStage = (value: string) => setStage(value);
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
    to: "favorite" | "comparison" | "rejected" | "inbox",
  ) => {
    await run(item.id, async () => {
      if (to === "favorite") await onFavorite(item.id);
      else
        await onMove?.(
          item.id,
          to,
          to === "rejected" ? reasons[item.id] || "暂不考虑" : undefined,
        );
      setOptimistic((current) => ({ ...current, [item.id]: to }));
      setCanUndo(true);
    });
  };
  const detail = items.find((item) => item.id === detailId);
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
        <h2>把喜欢的名字，慢慢留下</h2>
        <span>已保存 {items.length} 个名字</span>
      </div>
      <nav className="studio-tabs" aria-label="选名阶段">
        {[
          ["inbox", "灵感池", items.filter((x) => x.stage === "inbox").length],
          ["shortlist", "我的候选", items.filter(collection).length],
          ["rejected", "暂不考虑", items.filter((x) => x.stage === "rejected").length],
        ].map(([value, label, count]) => (
          <button
            type="button"
            key={value}
            aria-pressed={stage === value}
            onClick={() => changeStage(String(value))}
          >
            {label}
            <span>{count}</span>
          </button>
        ))}
      </nav>
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
      </div>
      <div className="studio-toolbar">
        <span role="status">
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
          {stage === "shortlist" && onOpenComparison ? (
            <Button type="button" onClick={onOpenComparison}>
              打开候选对比
            </Button>
          ) : null}
        </div>
      </div>
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
              : stage === "shortlist"
                ? "把心动的名字收入这里"
                : "暂时没有符合条件的名字"}
          </h3>
          <p>
            {stage === "shortlist"
              ? "在灵感池点击“收入候选”，再打分、写备注和加入对比。"
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
          <Card key={item.id} className="candidate-card" data-stage={item.stage}>
            <div className="candidate-card__header">
              <div>
                <h2>{item.fullName}</h2>
                <p>{item.pinyin.join(" · ")}</p>
              </div>
              <span className="ui-status">{labels[item.sourceType]}</span>
            </div>
            <p className="candidate-card__meaning">{item.summary}</p>
            <div className="candidate-tags">
              {item.styleTags?.slice(0, 2).map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
              <span>系统匹配 {item.systemScore ?? 0}/100</span>
            </div>
            {item.warnings.length ? (
              <p className="candidate-card__warning">{item.warnings[0]!.explanation}</p>
            ) : (
              <p className="candidate-card__safe">当前规则未发现明显风险 · 仍请全名试读</p>
            )}
            {collection(item) ? (
              <div className="candidate-card__evaluation">
                <label>
                  个人评分
                  <select
                    aria-label={`评分${item.fullName}`}
                    value={ratings[item.id] ?? item.rating ?? ""}
                    disabled={Boolean(busy)}
                    onChange={(e) =>
                      saveEvaluation(
                        item,
                        Number(e.target.value),
                        notes[item.id] ?? item.note ?? "",
                      )
                    }
                  >
                    <option disabled value="">
                      未评分
                    </option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n} 分
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  心选理由
                  <input
                    aria-label={`备注${item.fullName}`}
                    value={notes[item.id] ?? item.note ?? ""}
                    placeholder="喜欢哪里，家人怎么说…"
                    onChange={(e) =>
                      setNotes((current) => ({ ...current, [item.id]: e.target.value }))
                    }
                    onBlur={(event) => {
                      const note = event.currentTarget.value;
                      if (note !== item.note)
                        saveEvaluation(
                          item,
                          evaluationDrafts.current[item.id]?.rating ??
                            ratings[item.id] ??
                            item.rating ??
                            3,
                          note,
                        );
                    }}
                  />
                </label>
              </div>
            ) : null}
            {item.stage === "rejected" ? (
              <p>暂不考虑：{item.rejectionReason ?? reasons[item.id] ?? "已移出灵感池"}</p>
            ) : null}
            <div className="candidate-card__actions">
              <button
                type="button"
                aria-label={`查看${item.fullName}详情`}
                onClick={(event) => {
                  event.currentTarget.focus();
                  setDetailId(item.id);
                }}
              >
                释名与民俗 ↗
              </button>
              {item.stage === "inbox" ? (
                <Button
                  type="button"
                  disabled={Boolean(busy)}
                  aria-label={`收入候选${item.fullName}`}
                  onClick={() => void move(item, "favorite")}
                >
                  收入候选
                </Button>
              ) : item.stage === "rejected" ? (
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void move(item, "inbox")}
                >
                  恢复到灵感池
                </button>
              ) : item.stage === "favorite" ? (
                <Button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void move(item, "comparison")}
                >
                  加入对比
                </Button>
              ) : (
                <span className="ui-status">
                  {item.stage === "comparison" ? "已在对比池" : "最终候选"}
                </span>
              )}
            </div>
            {item.stage !== "rejected" && item.stage !== "finalist" ? (
              <details className="candidate-dismiss">
                <summary>暂不考虑这个名字</summary>
                <input
                  aria-label={`淘汰理由${item.fullName}`}
                  value={reasons[item.id] ?? ""}
                  onChange={(e) =>
                    setReasons((current) => ({ ...current, [item.id]: e.target.value }))
                  }
                  placeholder="可选：记下原因"
                />
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void move(item, "rejected")}
                >
                  暂不考虑
                </button>
              </details>
            ) : null}
          </Card>
        ))}
      </section>
      {filtered.length > limit ? (
        <Button type="button" onClick={() => setLimit((n) => n + 48)}>
          显示更多名字
        </Button>
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
          <NameExplanation candidate={detail} profile={profile} />
          {detail.stage === "inbox" ? (
            <Button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => void move(detail, "favorite")}
            >
              收入候选{detail.fullName}
            </Button>
          ) : (
            <span className="ui-status">
              {detail.stage === "rejected" ? "暂不考虑" : "已收入候选"}
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
