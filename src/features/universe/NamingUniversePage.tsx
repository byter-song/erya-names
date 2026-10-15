import { useRef, useState, type ReactNode } from "react";
import { Button } from "../../design-system/primitives/Button";
import type { CandidateFunnelItem } from "../../application/models/CandidateFunnelItem";
import { activeRuntimeBundle } from "../../data/activeRuntimeBundle";
import type { NamingProfile } from "../../domain/project/profile";
import "./naming-universe.css";

export interface NamingUniverseControls {
  focusRequest?: NamingUniverseFocusRequest | undefined;
  generationControls: ReactNode;
  onGenerateMore: () => Promise<void>;
  generationBusy: boolean;
  latestBatchId?: string | undefined;
}

export interface NamingUniverseFocusRequest {
  candidateId?: string | undefined;
  requestId: number;
  stage: "inbox" | "basic" | "folklore";
}

const GENERATION_BATCH_SIZE = 9;

const genderLabels: Record<NonNullable<NamingProfile["childGender"]>, string> = {
  male: "男孩参照",
  female: "女孩参照",
  unknown: "性别暂未确定",
};

const constraintLabels: Record<NonNullable<NamingProfile["constraintKnowledge"]>, string> = {
  present: "家庭边界已设置",
  none: "家庭边界已确认无",
  unknown: "家庭边界待核对",
};

export function NamingUniversePage({
  profile,
  candidates,
  datasetVersion,
  generate,
  children,
  conditions,
  onOpenComparison,
  onOpenFinalization,
}: {
  profile: NamingProfile;
  candidates: CandidateFunnelItem[];
  datasetVersion: string;
  generate: (input: {
    requestedCount: number;
    allusionRatio: number;
  }) => Promise<{ candidateCount: number; batchId?: string | undefined }>;
  children?: ReactNode | ((controls: NamingUniverseControls) => ReactNode);
  conditions?: ReactNode;
  onOpenComparison?: (() => void) | undefined;
  onOpenFinalization?: (() => void) | undefined;
}) {
  const [ratio, setRatio] = useState(0.5);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<number>();
  const [latestBatchId, setLatestBatchId] = useState<string>();
  const [error, setError] = useState("");
  const [decisionGuard, setDecisionGuard] = useState(false);
  const [comparisonPreviewOpen, setComparisonPreviewOpen] = useState(false);
  const [finalGuard, setFinalGuard] = useState(false);
  const [finalPreviewOpen, setFinalPreviewOpen] = useState(false);
  const [focusRequest, setFocusRequest] = useState<NamingUniverseFocusRequest>();
  const comparisonPreviewHeading = useRef<HTMLHeadingElement>(null);
  const finalPreviewHeading = useRef<HTMLHeadingElement>(null);

  const folkloreEnabled = profile.folklore.enabled;
  const childGender = profile.childGender ?? "unknown";
  const familyState = profile.constraintKnowledge ?? "unknown";
  const orbit = buildUniverseOrbit(profile, candidates);
  const batches = summarizeBatches(candidates);
  const counts = countCandidateStages(candidates);
  const comparisonPreviewCandidates = getComparisonPreviewCandidates(candidates);
  const finalPreviewCandidates = getFinalPreviewCandidates(candidates);
  const conditionLine = [
    `${profile.surname}姓`,
    genderLabels[childGender],
    profile.givenNameLength === 2 ? "二字名" : "一字名",
    profile.styleTags.join(" / ") || "风格不限",
  ].join(" / ");

  const openDecisionRing = () => {
    if (comparisonPreviewCandidates.length > 0) {
      setDecisionGuard(false);
      setFinalGuard(false);
      setFinalPreviewOpen(false);
      setComparisonPreviewOpen(true);
      requestAnimationFrame(() => comparisonPreviewHeading.current?.focus());
      return;
    }
    setComparisonPreviewOpen(false);
    setDecisionGuard(true);
    setFocusRequest({
      requestId: Date.now(),
      stage: counts.folklore > 0 ? "folklore" : counts.basic > 0 ? "basic" : "inbox",
    });
  };

  const openFinalSeal = () => {
    if (finalPreviewCandidates.length > 0) {
      setDecisionGuard(false);
      setFinalGuard(false);
      setComparisonPreviewOpen(false);
      setFinalPreviewOpen(true);
      requestAnimationFrame(() => finalPreviewHeading.current?.focus());
      return;
    }
    setComparisonPreviewOpen(false);
    setFinalPreviewOpen(false);
    setFinalGuard(true);
    if (counts.comparison > 0) {
      onOpenComparison?.();
      return;
    }
    setFocusRequest({
      requestId: Date.now(),
      stage: counts.folklore > 0 ? "folklore" : counts.basic > 0 ? "basic" : "inbox",
    });
  };

  const start = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const generated = await generate({
        requestedCount: GENERATION_BATCH_SIZE,
        allusionRatio: ratio,
      });
      setResult(generated.candidateCount);
      if (generated.candidateCount > 0 && generated.batchId)
        setLatestBatchId(generated.batchId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "生成失败，请重试");
    } finally {
      setBusy(false);
    }
  };

  const generationControls = (
    <section className="universe-seed-panel" aria-label="播种一批名字">
      <div>
        <p className="eyebrow">Seeding</p>
        <h2>播种一批名字</h2>
        <p>
          先按规范字、家庭边界和读写风险过滤，再按风格与文脉排序。历史名字会跨批去重。
        </p>
      </div>
      <div className="universe-seed-controls">
        <label>
          取名方向
          <select
            aria-label="典故比例"
            disabled={busy}
            value={ratio}
            onChange={(event) => setRatio(Number(event.target.value))}
          >
            <option value={0.5}>典故与字义兼顾</option>
            <option value={1}>典故优先</option>
            <option value={0}>字义组合优先</option>
          </select>
        </label>
        <Button
          disabled={busy || activeRuntimeBundle.characters.length === 0}
          type="button"
          onClick={() => void start()}
        >
          {busy ? "正在播种…" : "播种 9 个名字"}
        </Button>
      </div>
      {result !== undefined ? (
        <div className="universe-seed-result" role="status">
          <strong>{result > 0 ? "名字对象已落位" : "这组环境暂时没有新的名字"}</strong>
          <span>
            {result < GENERATION_BATCH_SIZE
              ? "符合条件且未生成过的结果不足目标数；可放宽条件或继续查看历史批次。"
              : "新名字已进入外围漂浮区，喜欢的可收入稳定轨道。"}
          </span>
        </div>
      ) : null}
      {error ? (
        <p className="onboarding__error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );

  return (
    <main className="naming-universe">
      <header className="universe-hero">
        <div>
          <p className="project-center__kicker">ERYA · 生长式命名宇宙</p>
          <h1>{profile.surname}氏命名场</h1>
          <p>{conditionLine}</p>
        </div>
        <div className="universe-version" aria-label="本地数据状态">
          <span>本机计算</span>
          <strong>{datasetVersion}</strong>
        </div>
      </header>

      {activeRuntimeBundle.characters.length === 0 ? (
        <p role="status" className="insight-note">
          起名资料未载入，暂时停止播种。已有名字仍可阅读、备份；恢复本地服务后重新载入即可继续。
        </p>
      ) : null}

      <section className="universe-field" aria-labelledby="universe-field-title">
        <div className="universe-sky" aria-hidden="true">
          <span className="universe-line universe-line--one" />
          <span className="universe-line universe-line--two" />
          <span className="universe-line universe-line--three" />
        </div>
        <div className="universe-field__copy">
          <p className="eyebrow">Naming Field</p>
          <h2 id="universe-field-title">有限命名场</h2>
          <p>
            名字是唯一对象：从外围灵感进入稳定轨道，经过文化透镜，再被决策引力环吸附。
          </p>
        </div>
        <div className="universe-orbit" aria-label="命名场状态">
          <button
            className="universe-lens"
            type="button"
            onClick={() => setFocusRequest({ requestId: Date.now(), stage: "folklore" })}
          >
            <span>文化透镜</span>
            <strong>{folkloreEnabled ? "四柱 · 五行" : "未启用"}</strong>
            <small>传统民俗参考，非科学结论</small>
          </button>
          <div className="universe-batches" aria-label="历史批次">
            {batches.length ? (
              batches.map((batch, index) => (
                <span key={batch.id}>
                  第 {batches.length - index} 批 · {batch.count} 名
                </span>
              ))
            ) : (
              <span>尚未播种</span>
            )}
          </div>
          <button
            className="universe-name universe-name--focus"
            type="button"
            onClick={() => setFocusRequest(toFocusRequest(orbit.focus))}
          >
            <strong>{orbit.focus.name}</strong>
            <span>{orbit.focus.label}</span>
          </button>
          <button
            className="universe-name universe-name--left"
            type="button"
            onClick={() => setFocusRequest(toFocusRequest(orbit.left))}
          >
            <strong>{orbit.left.name}</strong>
            <span>{orbit.left.label}</span>
          </button>
          <button
            className="universe-name universe-name--right"
            type="button"
            onClick={() => setFocusRequest(toFocusRequest(orbit.right))}
          >
            <strong>{orbit.right.name}</strong>
            <span>{orbit.right.label}</span>
          </button>
          <button className="universe-ring" type="button" onClick={openDecisionRing}>
            <strong>决策引力环</strong>
            <span>
              重点 {counts.comparison} / 定稿 {counts.finalist}
            </span>
          </button>
          <button className="universe-final-seal" type="button" onClick={openFinalSeal}>
            <strong>封存核心</strong>
            <span>定稿 {counts.finalist} / 5</span>
          </button>
        </div>
        {decisionGuard && counts.comparison === 0 ? (
          <div className="universe-decision-guard" role="status">
            <strong>还没有重点候选</strong>
            <span>
              {counts.basic + counts.folklore > 0
                ? "先在下方候选中选择“加入重点候选”，再进入比较。"
                : "先播种一批名字，并把喜欢的名字收入基础候选。"}
            </span>
            <button
              type="button"
              onClick={() =>
                setFocusRequest({
                  requestId: Date.now(),
                  stage: counts.folklore > 0 ? "folklore" : counts.basic > 0 ? "basic" : "inbox",
                })
              }
            >
              {counts.basic + counts.folklore > 0 ? "去选择重点候选" : "去播种名字"}
            </button>
          </div>
        ) : null}
        {comparisonPreviewOpen && comparisonPreviewCandidates.length > 0 ? (
          <section
            aria-labelledby="universe-comparison-preview-title"
            className="universe-comparison-preview"
          >
            <div className="universe-comparison-preview__heading">
              <div>
                <p className="eyebrow">Comparison Reflow</p>
                <h3 id="universe-comparison-preview-title" ref={comparisonPreviewHeading} tabIndex={-1}>
                  命名场内比较预览
                </h3>
                <p>先在当前命名场中快速对齐核心差异；需要编辑快照或定稿时再进入完整比较页。</p>
              </div>
              <div className="universe-comparison-preview__actions">
                <button type="button" onClick={() => setComparisonPreviewOpen(false)}>
                  收起预览
                </button>
                <Button type="button" onClick={onOpenComparison}>
                  进入完整比较
                </Button>
              </div>
            </div>
            <div className="universe-comparison-preview__table" role="region" aria-label="重点候选快速比较">
              <table>
                <thead>
                  <tr>
                    <th scope="col">属性</th>
                    {comparisonPreviewCandidates.map((candidate) => (
                      <th key={candidate.id} scope="col">
                        {candidate.fullName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["阶段", (candidate: CandidateFunnelItem) => previewStageLabel(candidate)],
                    ["来源", (candidate: CandidateFunnelItem) => previewSourceLabel(candidate)],
                    [
                      "读音",
                      (candidate: CandidateFunnelItem) =>
                        candidate.pinyin.join(" · ") || "待人工确认",
                    ],
                    ["寓意", (candidate: CandidateFunnelItem) => candidate.summary],
                    [
                      "系统匹配",
                      (candidate: CandidateFunnelItem) => `${candidate.systemScore ?? 0}/100`,
                    ],
                    ["使用提醒", (candidate: CandidateFunnelItem) => previewRiskLabel(candidate)],
                    ["民俗参考", (candidate: CandidateFunnelItem) => previewFolkloreLabel(candidate)],
                    [
                      "个人记录",
                      (candidate: CandidateFunnelItem) =>
                        [candidate.rating ? `${candidate.rating} 分` : "", candidate.note ?? ""]
                          .filter(Boolean)
                          .join(" · ") || "未记录",
                    ],
                  ].map(([label, value]) => (
                    <tr key={String(label)}>
                      <th scope="row">{String(label)}</th>
                      {comparisonPreviewCandidates.map((candidate) => (
                        <td key={candidate.id}>
                          {(value as (item: CandidateFunnelItem) => string)(candidate)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
        {finalGuard && finalPreviewCandidates.length === 0 ? (
          <div className="universe-decision-guard universe-decision-guard--final" role="status">
            <strong>还没有定稿候选</strong>
            <span>
              {counts.comparison > 0
                ? "先在完整比较中把名字加入定稿名单，再回到这里封存。"
                : "先把名字加入重点候选，再进入比较和定稿。"}
            </span>
            <button
              type="button"
              onClick={() => {
                if (counts.comparison > 0) {
                  onOpenComparison?.();
                  return;
                }
                setFocusRequest({
                  requestId: Date.now(),
                  stage: counts.folklore > 0 ? "folklore" : counts.basic > 0 ? "basic" : "inbox",
                });
              }}
            >
              {counts.comparison > 0 ? "进入完整比较" : "去选择重点候选"}
            </button>
          </div>
        ) : null}
        {finalPreviewOpen && finalPreviewCandidates.length > 0 ? (
          <section
            aria-labelledby="universe-final-preview-title"
            className="universe-final-preview"
          >
            <div className="universe-final-preview__heading">
              <div>
                <p className="eyebrow">Final Seal</p>
                <h3 id="universe-final-preview-title" ref={finalPreviewHeading} tabIndex={-1}>
                  命名场内封存预览
                </h3>
                <p>最终候选进入中心，普通候选退到远景；完整导出和名单调整仍在定稿页完成。</p>
              </div>
              <div className="universe-final-preview__actions">
                <button type="button" onClick={() => setFinalPreviewOpen(false)}>
                  收起预览
                </button>
                <Button type="button" onClick={onOpenFinalization}>
                  进入完整定稿
                </Button>
              </div>
            </div>
            <div className="universe-final-preview__names" aria-label="定稿候选预览">
              {finalPreviewCandidates.map((candidate, index) => (
                <article
                  className={index === 0 ? "universe-final-preview__name is-primary" : "universe-final-preview__name"}
                  key={candidate.id}
                >
                  <span>{index === 0 ? "首位候选" : `备选 ${index + 1}`}</span>
                  <strong>{candidate.fullName}</strong>
                  <p>{candidate.summary}</p>
                  <small>{candidate.rating ? `${candidate.rating} 分` : "未评分"}</small>
                </article>
              ))}
            </div>
          </section>
        ) : null}
        <div className="universe-environment">
          <span>{conditionLine}</span>
          <span>{constraintLabels[familyState]}</span>
          <span>
            灵感 {counts.inbox} · 基础 {counts.basic} · 民俗 {counts.folklore}
          </span>
          <a href="#conditions">调整条件环境</a>
        </div>
      </section>

      <section className="universe-workspace" aria-label="命名对象工作区">
        <aside className="universe-environment-panel" aria-label="条件环境">
          <div className="universe-panel-heading">
            <p className="eyebrow">Condition Environment</p>
            <h2>条件环境</h2>
            <p>保存后只影响下一批或下一轮；旧候选保留生成时的环境。</p>
          </div>
          {conditions}
        </aside>
        <section className="universe-object-flow" aria-label="名字对象流">
          {typeof children === "function"
            ? children({
                focusRequest,
                generationControls,
                onGenerateMore: start,
                generationBusy: busy,
                ...(latestBatchId ? { latestBatchId } : {}),
              })
            : children}
        </section>
      </section>

      <details className="universe-library">
        <summary>资料与命名边界</summary>
        <div className="guide-grid">
          <section>
            <h3>先好用，再动心</h3>
            <p>
              先确认登记、规范字、家庭避讳与全名读音，再看字义、典故和书写。
            </p>
          </section>
          <section>
            <h3>文化透镜</h3>
            <p>
              民俗内容只作为传统文化参考，不输出吉凶和人生预测，也不自动推断喜用神。
            </p>
          </section>
        </div>
        <p>
          内容包 {datasetVersion} · {activeRuntimeBundle.characters.length} 个用字 ·{" "}
          {activeRuntimeBundle.allusions.length} 条典故
          {activeRuntimeBundle.modernCombinations?.length
            ? ` · ${activeRuntimeBundle.modernCombinations.length} 个现代组合`
            : ""}
          。
        </p>
      </details>
    </main>
  );
}

function getComparisonPreviewCandidates(candidates: CandidateFunnelItem[]): CandidateFunnelItem[] {
  return [...candidates]
    .filter((candidate) => ["comparison", "finalist"].includes(candidate.stage))
    .sort((left, right) => {
      const stageDelta = previewStageWeight(right) - previewStageWeight(left);
      if (stageDelta) return stageDelta;
      return (right.systemScore ?? 0) - (left.systemScore ?? 0);
    })
    .slice(0, 5);
}

function getFinalPreviewCandidates(candidates: CandidateFunnelItem[]): CandidateFunnelItem[] {
  return [...candidates]
    .filter((candidate) => candidate.stage === "finalist")
    .sort((left, right) => (right.rating ?? 0) - (left.rating ?? 0))
    .slice(0, 5);
}

function previewStageWeight(candidate: CandidateFunnelItem): number {
  if (candidate.stage === "finalist") return 2;
  if (candidate.stage === "comparison") return 1;
  return 0;
}

function previewStageLabel(candidate: CandidateFunnelItem): string {
  if (candidate.stage === "finalist") return "定稿候选";
  return "重点候选";
}

function previewSourceLabel(candidate: CandidateFunnelItem): string {
  const labels = {
    modern_combination: "现代组合",
    user_input: "手工录入",
    verified_allusion: "古籍取名",
  } as const;
  return labels[candidate.sourceType];
}

function previewRiskLabel(candidate: CandidateFunnelItem): string {
  return candidate.warnings[0]?.explanation ?? "当前未发现明显风险";
}

function previewFolkloreLabel(candidate: CandidateFunnelItem): string {
  if (!candidate.folkloreReviewed) return "未复筛";
  const folkloreRules = candidate.ruleEvidence?.filter((rule) => rule.evidenceLevel === "L4");
  return folkloreRules?.[0]?.explanation ?? "已复筛";
}

type OrbitNode = {
  candidateId?: string | undefined;
  label: string;
  name: string;
  stage: "inbox" | "basic" | "folklore";
};

function toFocusRequest(node: OrbitNode): NamingUniverseFocusRequest {
  return {
    ...(node.candidateId ? { candidateId: node.candidateId } : {}),
    requestId: Date.now(),
    stage: node.stage,
  };
}

function bestCandidate(
  candidates: CandidateFunnelItem[],
  predicate: (candidate: CandidateFunnelItem) => boolean,
  excludedIds: Set<string> = new Set(),
): CandidateFunnelItem | undefined {
  return [...candidates]
    .filter((candidate) => predicate(candidate) && !excludedIds.has(candidate.id))
    .sort((left, right) => {
      const scoreDelta = (right.systemScore ?? 0) - (left.systemScore ?? 0);
      if (scoreDelta) return scoreDelta;
      return (right.createdAt ?? "").localeCompare(left.createdAt ?? "");
    })[0];
}

function buildNode(
  profile: NamingProfile,
  candidate: CandidateFunnelItem | undefined,
  fallback: string,
  label: string,
  stage: NamingUniverseFocusRequest["stage"],
): OrbitNode {
  return {
    ...(candidate ? { candidateId: candidate.id } : {}),
    label,
    name: candidate?.fullName ?? `${profile.surname}${fallback}`,
    stage,
  };
}

function buildUniverseOrbit(
  profile: NamingProfile,
  candidates: CandidateFunnelItem[],
): {
  focus: OrbitNode;
  left: OrbitNode;
  right: OrbitNode;
} {
  const finalOrComparison = bestCandidate(candidates, (candidate) =>
    ["finalist", "comparison"].includes(candidate.stage),
  );
  const basic = bestCandidate(candidates, (candidate) =>
    ["basic_shortlist", "favorite"].includes(candidate.stage),
  );
  const folklore = bestCandidate(candidates, (candidate) =>
    candidate.stage === "folklore_review" || Boolean(candidate.folkloreReviewed),
  );
  const inbox = bestCandidate(candidates, (candidate) => candidate.stage === "inbox");
  const usedIds = new Set<string>();
  const focusCandidate = finalOrComparison ?? folklore ?? basic ?? inbox;
  if (focusCandidate) usedIds.add(focusCandidate.id);
  const leftCandidate =
    bestCandidate(
      candidates,
      (candidate) => candidate.stage === "folklore_review" || Boolean(candidate.folkloreReviewed),
      usedIds,
    ) ?? bestCandidate(candidates, (candidate) => candidate.stage === "basic_shortlist", usedIds);
  if (leftCandidate) usedIds.add(leftCandidate.id);
  const rightCandidate =
    bestCandidate(candidates, (candidate) => candidate.stage === "inbox", usedIds) ??
    bestCandidate(candidates, (candidate) => candidate.stage === "comparison", usedIds);
  const leftIsFolklore = Boolean(
    leftCandidate &&
      (leftCandidate.stage === "folklore_review" || Boolean(leftCandidate.folkloreReviewed)),
  );
  const rightIsInbox = rightCandidate?.stage === "inbox";

  return {
    focus: buildNode(
      profile,
      focusCandidate,
      "知微",
      finalOrComparison
        ? "决策引力环"
        : folklore
          ? "文化轨道"
          : basic
            ? "稳定轨道"
            : inbox
              ? "外围漂浮区"
              : "待播种",
      finalOrComparison ? "basic" : folklore ? "folklore" : basic ? "basic" : "inbox",
    ),
    left: buildNode(
      profile,
      leftCandidate,
      "望舒",
      leftCandidate ? (leftIsFolklore ? "文化轨道" : "稳定轨道") : "文化轨道待生成",
      leftCandidate ? (leftIsFolklore ? "folklore" : "basic") : "folklore",
    ),
    right: buildNode(
      profile,
      rightCandidate,
      "清晏",
      rightCandidate ? (rightIsInbox ? "外围漂浮区" : "决策引力环") : "外围漂浮区待生成",
      rightCandidate ? (rightIsInbox ? "inbox" : "basic") : "inbox",
    ),
  };
}

function countCandidateStages(candidates: CandidateFunnelItem[]): {
  basic: number;
  comparison: number;
  finalist: number;
  folklore: number;
  inbox: number;
} {
  return {
    inbox: candidates.filter((candidate) => candidate.stage === "inbox").length,
    basic: candidates.filter((candidate) =>
      ["basic_shortlist", "favorite"].includes(candidate.stage),
    ).length,
    folklore: candidates.filter(
      (candidate) =>
        candidate.stage === "folklore_review" ||
        (Boolean(candidate.folkloreReviewed) &&
          ["comparison", "finalist"].includes(candidate.stage)),
    ).length,
    comparison: candidates.filter((candidate) => candidate.stage === "comparison").length,
    finalist: candidates.filter((candidate) => candidate.stage === "finalist").length,
  };
}

function summarizeBatches(
  candidates: CandidateFunnelItem[],
): Array<{ count: number; id: string; latestCreatedAt: string }> {
  const batches = new Map<string, { count: number; id: string; latestCreatedAt: string }>();
  for (const candidate of candidates) {
    if (!candidate.batchId) continue;
    const current = batches.get(candidate.batchId);
    if (!current) {
      batches.set(candidate.batchId, {
        count: 1,
        id: candidate.batchId,
        latestCreatedAt: candidate.createdAt ?? "",
      });
      continue;
    }
    current.count += 1;
    if ((candidate.createdAt ?? "") > current.latestCreatedAt)
      current.latestCreatedAt = candidate.createdAt ?? "";
  }
  return [...batches.values()]
    .sort((left, right) => right.latestCreatedAt.localeCompare(left.latestCreatedAt))
    .slice(0, 4);
}
