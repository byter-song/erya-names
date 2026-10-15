import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { CandidateFunnelItem } from "../../application/models/CandidateFunnelItem";
import type { NamingProfile } from "../../domain/project/profile";
import { readSurname } from "../../domain/candidate/nameReading";
import { Dialog } from "../../design-system/primitives/Dialog";
import { NameExplanation } from "../insights/NameExplanation";
import { AddManualCandidateDialog } from "../funnel/AddManualCandidateDialog";
import { ScrollCandidateActions, type ScrollActions } from "./ScrollCandidateActions";
import { useScrollNavigation } from "./useScrollNavigation";
import "./ink-long-scroll.css";

export type ScrollChapter = "inbox" | "basic" | "folklore" | "excluded";
const chapters: Record<ScrollChapter, { label: string; stages: string[]; hint: string }> = {
  inbox: {
    label: "灵感池",
    stages: ["inbox"],
    hint: "先读名字，再看出处。喜欢的保留到基础候选。",
  },
  basic: {
    label: "基础候选",
    stages: ["basic_shortlist", "favorite"],
    hint: "核对读音、字义与家庭规则，再进入民俗候选或直接比较。",
  },
  folklore: {
    label: "民俗候选",
    stages: ["folklore_review"],
    hint: "按家庭偏好参考八字、五行与生肖；生肖提示不拦截名字。",
  },
  excluded: {
    label: "暂不考虑",
    stages: ["excluded", "rejected"],
    hint: "保留排除理由，也可以随时恢复到灵感池。",
  },
};
export interface InkLongScrollPageProps extends ScrollActions {
  profile: NamingProfile;
  candidates: CandidateFunnelItem[];
  datasetVersion: string;
  generationBusy: boolean;
  onGenerate: () => Promise<void>;
  onUndo: () => Promise<boolean>;
  onAddManual: (input: {
    fullName: string;
    userSource: string;
    meaning: string;
  }) => Promise<void>;
  onOpenComparison: () => void;
  onOpenFinalization: () => void;
  conditions: ReactNode;
  folkloreSettings: ReactNode;
  generationSettings?: ReactNode;
  chapter: ScrollChapter;
  onChapterChange: (chapter: ScrollChapter) => void;
  initialPanel?: "conditions" | null;
}
export function InkLongScrollPage(props: InkLongScrollPageProps) {
  const { profile, candidates, generationBusy, onGenerate, chapter, onChapterChange } = props;
  const [sidePanel, setSidePanel] = useState<"conditions" | "folklore" | "generation" | null>(
    props.initialPanel ?? null,
  );
  const [detailId, setDetailId] = useState<string>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  useEffect(() => {
    if (props.initialPanel) setSidePanel(props.initialPanel);
  }, [props.initialPanel]);
  const folkloreScore = (c: CandidateFunnelItem) =>
    (c.ruleEvidence ?? [])
      .filter((r) => r.evidenceLevel === "L4")
      .reduce((sum, r) => sum + (r.scoreDelta ?? 0), 0);
  const frames = useMemo(
    () =>
      candidates
        .filter(
          (c) =>
            chapters[chapter].stages.includes(c.stage) &&
            (!search.trim() ||
              c.fullName.includes(search.trim()) ||
              c.summary.includes(search.trim())),
        )
        .sort(
          (a, b) =>
            (chapter === "folklore" &&
            profile.folklore.enabled &&
            profile.folklore.includeInRanking
              ? folkloreScore(b) - folkloreScore(a)
              : 0) ||
            (a.createdAt ?? "").localeCompare(b.createdAt ?? "") ||
            a.id.localeCompare(b.id),
        ),
    [candidates, chapter, search, profile.folklore.enabled, profile.folklore.includeInRanking],
  );
  const { ref, index, panelWidth, lead, go } = useScrollNavigation(
    frames.length,
    `${chapter}:${search}`,
  );
  const start = Math.max(0, index - 3);
  const end = Math.min(frames.length, index + 4);
  const detail = candidates.find((c) => c.id === detailId);
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
          <label className="ils__search">
            查找本卷
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="姓名或释义"
            />
          </label>
          <button
            aria-pressed={chapter === "excluded"}
            onClick={() => onChapterChange(chapter === "excluded" ? "inbox" : "excluded")}
          >
            暂不考虑 (
            {candidates.filter((c) => chapters.excluded.stages.includes(c.stage)).length})
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
      <div className="ils__feedback" aria-live="polite">
        {notice}
        {error && <span role="alert">{error}</span>}
      </div>
      <div
        className="ils__scroller"
        ref={ref}
        tabIndex={0}
        aria-label="横向名字长卷，左右方向键翻阅"
        onKeyDown={(e) => {
          if (
            e.target !== e.currentTarget ||
            !["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)
          )
            return;
          e.preventDefault();
          go(
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? frames.length - 1
                : index + (e.key === "ArrowRight" ? 1 : -1),
          );
        }}
      >
        {frames.length ? (
          <div className="ils__track" style={{ width: frames.length * panelWidth + lead * 2 }}>
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
                    ...readSurname(profile.surname, profile.surnamePinyin),
                    ...candidate.pinyin,
                  ].join(" · ")}
                </p>
                <h2 className="ils__name brush-type">{candidate.fullName}</h2>
                <p className="ils__summary">{candidate.summary}</p>
                {candidate.eligibilityIssue && (
                  <p className="ils__eligibility">当前条件：{candidate.eligibilityIssue}</p>
                )}
                <div className="ils__actions">
                  <button
                    onClick={(e) => {
                      e.currentTarget.focus();
                      setDetailId(candidate.id);
                    }}
                  >
                    查看{candidate.fullName}详情
                  </button>
                  {candidate.stage === "inbox" && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await props.onMove(candidate.id, "basic_shortlist");
                          setNotice(`${candidate.fullName}已保留到基础候选`);
                        })
                      }
                    >
                      保留到基础候选
                    </button>
                  )}
                </div>
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
            <h2 className="brush-type">
              {search
                ? "这一卷暂未找到"
                : chapter === "inbox"
                  ? `为${profile.surname}姓宝宝铺开一卷`
                  : `这里还没有${chapters[chapter].label}`}
            </h2>
            <p>
              {search
                ? "换个关键词，或清空查找条件。"
                : chapter === "inbox"
                  ? "选择灵感来源，生成后逐个读名、留名。"
                  : "从前一卷保留名字后，会在这里继续斟酌。"}
            </p>
            {chapter === "inbox" && !search && (
              <button disabled={generationBusy || busy} onClick={() => void run(onGenerate)}>
                {generationBusy ? "正在生成…" : "展卷 · 生成 9 个名字"}
              </button>
            )}
            {chapter !== "inbox" && (
              <button
                onClick={() => onChapterChange(chapter === "folklore" ? "basic" : "inbox")}
              >
                返回{chapter === "folklore" ? "基础候选" : "灵感池"}
              </button>
            )}
          </div>
        )}
      </div>
      <nav className="ils__paging" aria-label="长卷翻页">
        <button disabled={index === 0 || !frames.length} onClick={() => go(index - 1)}>
          上一帧
        </button>
        <span>{frames.length ? `${index + 1} / ${frames.length}` : "尚无名字"}</span>
        <button disabled={index >= frames.length - 1} onClick={() => go(index + 1)}>
          下一帧
        </button>
        {chapter === "inbox" && !!frames.length && (
          <button disabled={generationBusy || busy} onClick={() => void run(onGenerate)}>
            {generationBusy ? "正在生成…" : "续卷 · 再生成 9 个"}
          </button>
        )}
      </nav>
      <footer className="ils__dock">
        <button onClick={() => setSidePanel("conditions")}>调整条件</button>
        <button onClick={() => setSidePanel("generation")}>灵感来源</button>
        <button onClick={() => setSidePanel("folklore")}>民俗设置</button>
        <AddManualCandidateDialog onAdd={props.onAddManual} />
        <button onClick={props.onOpenComparison}>并卷比较</button>
        <button onClick={props.onOpenFinalization}>定稿名单</button>
      </footer>
      {sidePanel && (
        <Dialog
          title={
            sidePanel === "conditions"
              ? "起名条件"
              : sidePanel === "folklore"
                ? "民俗设置"
                : "灵感来源"
          }
          closeLabel="完成并返回长卷"
          onClose={() => setSidePanel(null)}
        >
          {sidePanel === "conditions"
            ? props.conditions
            : sidePanel === "folklore"
              ? props.folkloreSettings
              : props.generationSettings}
        </Dialog>
      )}
      {detail && (
        <Dialog
          title={`${detail.fullName}详情`}
          closeLabel="关闭详情"
          onClose={() => setDetailId(undefined)}
        >
          <NameExplanation
            candidate={detail}
            profile={profile}
            showFolklore={chapter === "folklore"}
          />
          <ScrollCandidateActions
            key={detail.id}
            candidate={detail}
            onMove={props.onMove}
            onEvaluate={props.onEvaluate}
            afterMove={() => setDetailId(undefined)}
          />
        </Dialog>
      )}
    </main>
  );
}
