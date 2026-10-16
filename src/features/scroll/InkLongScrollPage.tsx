import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { CandidateFunnelItem } from "../../application/models/CandidateFunnelItem";
import type { CandidateDetail } from "../../application/models/CandidateDetail";
import type { CandidatePool } from "../../domain/candidate/decision";
import type { NamingProfile } from "../../domain/project/profile";
import { readSurname } from "../../domain/candidate/nameReading";
import { Dialog } from "../../design-system/primitives/Dialog";
import { NameExplanation } from "../insights/NameExplanation";
import { AddManualCandidateDialog } from "../funnel/AddManualCandidateDialog";
import { ScrollCandidateActions, type ScrollActions } from "./ScrollCandidateActions";
import { useScrollNavigation } from "./useScrollNavigation";
import "./ink-long-scroll.css";

export type ScrollChapter = CandidatePool;

const chapters: Record<ScrollChapter, { label: string; hint: string }> = {
  inspiration: {
    label: "灵感池",
    hint: "先读名字，再看出处；选择后进入候选池。",
  },
  candidate: {
    label: "候选池",
    hint: "核对规范、读音、寓意与已启用的民俗分析，再选择进入精选池。",
  },
  selected: {
    label: "精选池",
    hint: "这里的名字可以继续比较、补充理由并不限数量导出。",
  },
  excluded: {
    label: "已排除",
    hint: "保留排除理由，也可以恢复到排除前所在的池子。",
  },
};

const hardStatusOrder: Record<CandidateFunnelItem["hardStatus"], number> = {
  pass: 0,
  notice: 1,
  unknown: 2,
  conflict: 3,
};

const folkloreModuleLabels: Record<keyof NamingProfile["modules"], string> = {
  bazi_wuxing: "八字五行",
  zodiac: "生肖",
  traditional: "传统原则",
  name_hexagram: "姓名卦象",
  five_grids: "五格",
};

export interface InkLongScrollPageProps extends ScrollActions {
  profile: NamingProfile;
  candidates: CandidateFunnelItem[];
  generationBusy: boolean;
  analysisRecovery?: {
    message: string;
    busy: boolean;
    onRetry: () => Promise<void>;
  };
  onGenerate: () => Promise<void>;
  onUndo: () => Promise<boolean>;
  onAddManual: (input: {
    fullName: string;
    userSource: string;
    meaning: string;
  }) => Promise<void>;
  onOpenExport: () => void;
  onOpenConfiguration: () => void;
  onLoadCandidateDetail?: (candidateId: string) => Promise<CandidateDetail | undefined>;
  excludedSection?: ReactNode;
  comparisonContent?: ReactNode;
  chapter: ScrollChapter;
  onChapterChange: (chapter: ScrollChapter) => void;
}

export function InkLongScrollPage(props: InkLongScrollPageProps) {
  const { profile, candidates, generationBusy, onGenerate, chapter, onChapterChange } = props;
  const [detailId, setDetailId] = useState<string>();
  const [detailData, setDetailData] = useState<CandidateDetail>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [comparisonOpen, setComparisonOpen] = useState(false);

  useEffect(() => {
    setDetailData(undefined);
    if (!detailId || !props.onLoadCandidateDetail) return;
    let active = true;
    void props.onLoadCandidateDetail(detailId).then((loaded) => {
      if (active && loaded?.candidate.id === detailId) setDetailData(loaded);
    });
    return () => {
      active = false;
    };
  }, [detailId, props.onLoadCandidateDetail]);

  const frames = useMemo(
    () =>
      candidates
        .filter(
          (candidate) =>
            candidate.pool === chapter &&
            (!search.trim() ||
              candidate.fullName.includes(search.trim()) ||
              candidate.summary.includes(search.trim())),
        )
        .sort(
          (left, right) =>
            hardStatusOrder[left.hardStatus] - hardStatusOrder[right.hardStatus] ||
            (right.totalScore ?? -1) - (left.totalScore ?? -1) ||
            right.completeness - left.completeness ||
            (left.createdAt ?? "").localeCompare(right.createdAt ?? "") ||
            left.id.localeCompare(right.id),
        ),
    [candidates, chapter, search],
  );

  const { ref, index, panelWidth, lead, go } = useScrollNavigation(
    frames.length,
    `${chapter}:${search}`,
  );
  const start = Math.max(0, index - 3);
  const end = Math.min(frames.length, index + 4);
  const detail = candidates.find((candidate) => candidate.id === detailId);
  const enabledFolkloreModules = (
    Object.entries(profile.modules) as Array<
      [keyof NamingProfile["modules"], NamingProfile["modules"][keyof NamingProfile["modules"]]]
    >
  ).filter(([, settings]) => settings.analysisEnabled);
  const missingBirth =
    enabledFolkloreModules.some(([moduleId]) => ["bazi_wuxing", "zodiac"].includes(moduleId)) &&
    !profile.calendar.birthLocalDateTime;
  const usefulGodPending =
    profile.modules.bazi_wuxing.analysisEnabled &&
    Boolean(profile.calendar.birthLocalDateTime) &&
    !profile.usefulGodDecision;
  const familyPending = profile.family.constraintKnowledge === "unknown";

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "操作失败，请重试");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="ils" aria-label="起名长卷">
      <header className="ils__toolbar">
        <div>
          <h1>
            {chapters[chapter].label} <small>{frames.length} 个</small>
          </h1>
          <p>{chapters[chapter].hint}</p>
        </div>
        <div className="ils__actions">
          {chapter !== "excluded" ? (
            <label className="ils__search">
              查找本卷
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="姓名或释义"
              />
            </label>
          ) : null}
          {chapter === "candidate" && props.comparisonContent ? (
            <button onClick={() => setComparisonOpen(true)}>并列比较候选</button>
          ) : null}
          <button
            aria-pressed={chapter === "excluded"}
            onClick={() => onChapterChange(chapter === "excluded" ? "inspiration" : "excluded")}
          >
            已排除（{candidates.filter((candidate) => candidate.pool === "excluded").length}）
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                setNotice((await props.onUndo()) ? "已撤销上一步" : "没有可撤销的操作");
              })
            }
          >
            撤销上一步
          </button>
        </div>
      </header>

      <nav className="stage-tabs" aria-label="名字筛选阶段">
        {(["inspiration", "candidate", "selected"] as const).map((pool) => (
          <button
            aria-pressed={chapter === pool}
            key={pool}
            onClick={() => onChapterChange(pool)}
          >
            {chapters[pool].label}（
            {candidates.filter((candidate) => candidate.pool === pool).length}）
          </button>
        ))}
      </nav>

      <div className="ils__feedback" aria-live="polite">
        {notice}
        {error ? <span role="alert">{error}</span> : null}
      </div>

      {props.analysisRecovery ? (
        <aside className="ils__analysis-recovery" role="alert">
          <p>{props.analysisRecovery.message}</p>
          <button
            disabled={props.analysisRecovery.busy}
            onClick={() => void props.analysisRecovery?.onRetry()}
            type="button"
          >
            {props.analysisRecovery.busy ? "正在重新分析…" : "重新分析"}
          </button>
        </aside>
      ) : null}

      {missingBirth || usefulGodPending || familyPending ? (
        <aside className="ils__folklore-readiness" role="status">
          <div>
            <strong>民俗分析尚未完整</strong>
            <p>
              {[
                missingBirth ? "缺少出生日期与时辰" : "",
                usefulGodPending ? "用神采用项待确认" : "",
                familyPending ? "字辈与亲属避讳待核对" : "",
              ]
                .filter(Boolean)
                .join("；")}
              。名字可以继续筛选，当前综合分会标为暂定分。
            </p>
          </div>
          <button onClick={props.onOpenConfiguration}>去补充民俗资料</button>
        </aside>
      ) : null}

      {chapter === "excluded" && props.excludedSection ? (
        <div className="ils__excluded">{props.excludedSection}</div>
      ) : (
        <div
          className="ils__scroller"
          ref={ref}
          role="region"
          tabIndex={0}
          aria-label="横向名字长卷，左右方向键翻阅"
          onKeyDown={(event) => {
            if (
              event.target !== event.currentTarget ||
              !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
            )
              return;
            event.preventDefault();
            go(
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? frames.length - 1
                  : index + (event.key === "ArrowRight" ? 1 : -1),
            );
          }}
        >
          {frames.length ? (
            <div
              className="ils__track"
              style={{ width: frames.length * panelWidth + lead * 2 }}
            >
              <div className="ils__spacer" style={{ width: lead + start * panelWidth }} />
              {frames.slice(start, end).map((candidate, offset) => (
                <article
                  className={`ils__panel ${start + offset === index ? "is-center" : ""}`}
                  style={{ width: panelWidth }}
                  key={candidate.id}
                  data-candidate-id={candidate.id}
                >
                  <span className="ils__source">
                    {candidate.sourceType === "verified_allusion"
                      ? "诗词典故"
                      : candidate.sourceType === "user_input"
                        ? "手工灵感"
                        : candidate.sourceType === "historical_inspiration"
                          ? "状元灵感"
                          : "现代风格"}
                  </span>
                  <p className="ils__pinyin">
                    {[
                      ...readSurname(profile.basics.surname, profile.basics.surnamePinyin),
                      ...candidate.pinyin,
                    ].join(" · ")}
                  </p>
                  <h2 className="ils__name">{candidate.fullName}</h2>
                  <p className="ils__summary">{candidate.summary}</p>
                  <p className="ils__eligibility">
                    {candidate.scoringPending
                      ? "综合分析待完成"
                      : `${candidate.completeness < 1 ? "暂定综合分" : "综合分"} ${formatScore(candidate.totalScore)} · 模块得分 ${completedDimensionCount(candidate)}/${enabledFolkloreModules.length + 1} · 规则完整度 ${Math.round(candidate.completeness * 100)}%`}
                  </p>
                  {enabledFolkloreModules.length ? (
                    <ul className="ils__module-summary" aria-label="民俗分项摘要">
                      {enabledFolkloreModules.map(([moduleId]) => (
                        <li key={moduleId}>
                          <span>{folkloreModuleLabels[moduleId]}</span>
                          <strong>
                            {candidate.moduleScores[moduleId] === undefined
                              ? "待补资料"
                              : `${candidate.moduleScores[moduleId]}/100`}
                          </strong>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {candidate.topDeductions[0] ? (
                    <p className="candidate-card__warning">
                      {candidate.topDeductions[0].explanation}
                    </p>
                  ) : null}
                  <div className="ils__actions">
                    <button onClick={() => setDetailId(candidate.id)}>
                      查看{candidate.fullName}详情
                    </button>
                  </div>
                  <ScrollCandidateActions
                    candidate={candidate}
                    onMove={props.onMove}
                    onExclude={props.onExclude}
                    onRestore={props.onRestore}
                    onEvaluate={props.onEvaluate}
                    afterMove={() =>
                      setNotice(
                        candidate.pool === "excluded"
                          ? `${candidate.fullName}已恢复`
                          : `${candidate.fullName}已更新阶段`,
                      )
                    }
                    variant="card"
                  />
                  <span className="ils__frame-no">
                    第 {start + offset + 1} 帧 · 共 {frames.length} 帧
                  </span>
                </article>
              ))}
              <div
                className="ils__spacer"
                style={{ width: lead + (frames.length - end) * panelWidth }}
              />
            </div>
          ) : (
            <div className="ils__welcome">
              <h2>
                {search
                  ? "这一卷暂未找到"
                  : chapter === "inspiration"
                    ? `为${profile.basics.surname}姓宝宝铺开一卷`
                    : `这里还没有${chapters[chapter].label}`}
              </h2>
              <p>
                {search
                  ? "换个关键词，或清空查找条件。"
                  : chapter === "inspiration"
                    ? "选择灵感来源，生成后逐个读名、留名。"
                    : "从前一池选择名字后，会在这里继续斟酌。"}
              </p>
              {chapter === "inspiration" && !search ? (
                <button disabled={generationBusy || busy} onClick={() => void run(onGenerate)}>
                  {generationBusy ? "正在生成…" : "展卷 · 生成 9 个名字"}
                </button>
              ) : chapter !== "excluded" ? (
                <button onClick={() => onChapterChange("inspiration")}>返回灵感池</button>
              ) : null}
            </div>
          )}
        </div>
      )}

      {chapter !== "excluded" ? (
        <nav className="ils__paging" aria-label="长卷翻页">
          <button disabled={index === 0 || !frames.length} onClick={() => go(index - 1)}>
            上一帧
          </button>
          <span>{frames.length ? `${index + 1} / ${frames.length}` : "尚无名字"}</span>
          <button disabled={index >= frames.length - 1} onClick={() => go(index + 1)}>
            下一帧
          </button>
          {chapter === "inspiration" && frames.length ? (
            <button disabled={generationBusy || busy} onClick={() => void run(onGenerate)}>
              {generationBusy ? "正在生成…" : "续卷 · 再生成 9 个"}
            </button>
          ) : null}
        </nav>
      ) : null}

      <footer className="ils__dock">
        <button onClick={props.onOpenConfiguration}>民俗与起名配置</button>
        <AddManualCandidateDialog onAdd={props.onAddManual} />
        <button onClick={props.onOpenExport}>导出精选池</button>
      </footer>

      {detail ? (
        <Dialog
          title={`${detail.fullName}详情`}
          closeLabel="关闭详情"
          onClose={() => setDetailId(undefined)}
        >
          <NameExplanation
            candidate={detailData?.candidate ?? detail}
            {...(detailData
              ? {
                  evidence: detailData.evidence,
                  hiddenEvidenceCount: detailData.hiddenEvidenceCount,
                }
              : {})}
            profile={profile}
            showFolklore
          />
          <ScrollCandidateActions
            key={detail.id}
            candidate={detail}
            onMove={props.onMove}
            onExclude={props.onExclude}
            onRestore={props.onRestore}
            onEvaluate={props.onEvaluate}
            afterMove={() => setDetailId(undefined)}
          />
        </Dialog>
      ) : null}

      {comparisonOpen && props.comparisonContent ? (
        <Dialog
          title="候选名字并列比较"
          closeLabel="关闭比较"
          onClose={() => setComparisonOpen(false)}
        >
          {props.comparisonContent}
        </Dialog>
      ) : null}
    </main>
  );
}

function completedDimensionCount(candidate: CandidateFunnelItem): number {
  return Object.values(candidate.moduleScores).filter((score) => score !== undefined).length;
}

function formatScore(score: number | undefined): string {
  return score === undefined ? "—" : Number(score.toFixed(1)).toString();
}
