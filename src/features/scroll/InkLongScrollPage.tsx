import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CandidateFunnelItem } from "../../application/models/CandidateFunnelItem";
import type { NamingProfile } from "../../domain/project/profile";
import { NameExplanation } from "../insights/NameExplanation";
import "./ink-long-scroll.css";

const WINDOW_RADIUS = 3;
const PENDING_SLOTS = 5;
const DRAG_THRESHOLD = 6;

export interface InkLongScrollPageProps {
  profile: NamingProfile;
  candidates: CandidateFunnelItem[];
  datasetVersion: string;
  generationBusy: boolean;
  onGenerate: () => Promise<void>;
  onFavorite: (candidateId: string) => Promise<void>;
  onOpenComparison: () => void;
  onOpenFinalization: () => void;
  conditions: ReactNode;
  folkloreSettings: ReactNode;
  initialPanel?: "conditions" | null;
}

type SidePanel = "conditions" | "folklore" | null;

export function InkLongScrollPage({
  profile,
  candidates,
  generationBusy,
  onGenerate,
  onFavorite,
  conditions,
  folkloreSettings,
  initialPanel = null,
}: InkLongScrollPageProps) {
  // 生成顺序即帧顺序；无 createdAt 时回退 id 排序保证稳定
  const frames = useMemo(
    () =>
      [...candidates].sort(
        (a, b) =>
          (a.createdAt ?? "").localeCompare(b.createdAt ?? "") || a.id.localeCompare(b.id),
      ),
    [candidates],
  );
  const knownCount = frames.length;

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
  const panelWidth = useMemo(
    () => Math.min(Math.round(viewportWidth * 0.72), 760),
    [viewportWidth],
  );
  const lead = Math.round((viewportWidth - panelWidth) / 2);

  const [frame, setFrame] = useState(0);
  const [detailIndex, setDetailIndex] = useState<number>();
  const [sidePanel, setSidePanel] = useState<SidePanel>(initialPanel);

  const tweenRef = useRef<number>(0);
  const cancelTween = () => {
    if (tweenRef.current) cancelAnimationFrame(tweenRef.current);
    tweenRef.current = 0;
  };

  // —— 测量 ——
  useLayoutEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // 面板宽度变化后保持当前帧居中
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollLeft = frame * panelWidth;
    // frame 变化由滚动自身处理，这里只响应宽度变化
  }, [panelWidth]);

  // —— 滚动 → 当前帧 ——
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    let raf = 0;
    const sync = () => {
      raf = 0;
      const next = Math.max(0, Math.round(scroller.scrollLeft / panelWidth));
      setFrame((current) => (current === next ? current : next));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(sync);
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [panelWidth]);

  // —— 平滑滚动工具 ——
  const tweenTo = useCallback((targetScroll: number) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    cancelTween();
    const from = scroller.scrollLeft;
    const to = Math.max(0, targetScroll);
    const distance = to - from;
    if (Math.abs(distance) < 1) return;
    const duration = 280;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      scroller.scrollLeft = from + distance * eased;
      if (t < 1) tweenRef.current = requestAnimationFrame(step);
      else tweenRef.current = 0;
    };
    tweenRef.current = requestAnimationFrame(step);
  }, []);

  const snap = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    tweenTo(Math.round(scroller.scrollLeft / panelWidth) * panelWidth);
  }, [panelWidth, tweenTo]);

  // —— 滚轮：纵向滚动转横向 ——
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    let idleTimer: ReturnType<typeof setTimeout>;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      cancelTween();
      const lines = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewportWidth : 1;
      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX * lines
          : event.deltaY * lines;
      scroller.scrollLeft += delta;
      clearTimeout(idleTimer);
      idleTimer = setTimeout(snap, 130);
    };
    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      scroller.removeEventListener("wheel", onWheel);
      clearTimeout(idleTimer);
    };
  }, [snap, viewportWidth]);

  // —— 键盘方向键 ——
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      )
        return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      tweenTo((frame + direction) * panelWidth);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [frame, panelWidth, tweenTo]);

  // —— 按住拖拽：含惯性与吸附 ——
  const dragState = useRef({
    active: false,
    startX: 0,
    startScroll: 0,
    lastX: 0,
    lastT: 0,
    velocity: 0,
    moved: false,
  });

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const d = dragState.current;
      d.active = true;
      d.startX = d.lastX = event.clientX;
      d.startScroll = scroller.scrollLeft;
      d.lastT = performance.now();
      d.velocity = 0;
      d.moved = false;
      cancelTween();
      scroller.setPointerCapture?.(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      const d = dragState.current;
      if (!d.active) return;
      const dx = event.clientX - d.startX;
      if (Math.abs(dx) > DRAG_THRESHOLD) d.moved = true;
      const now = performance.now();
      const dt = now - d.lastT;
      if (dt > 0) d.velocity = ((event.clientX - d.lastX) / dt) * 0.6 + d.velocity * 0.4;
      d.lastX = event.clientX;
      d.lastT = now;
      scroller.scrollLeft = d.startScroll - dx;
    };
    const finish = (event: PointerEvent) => {
      const d = dragState.current;
      if (!d.active) return;
      d.active = false;
      scroller.releasePointerCapture?.(event.pointerId);

      if (!d.moved) return;
      // 惯性滑行后吸附
      let velocity = -d.velocity;
      const fling = () => {
        scroller.scrollLeft += velocity * 16;
        velocity *= 0.93;
        if (Math.abs(velocity) > 0.05) {
          tweenRef.current = requestAnimationFrame(fling);
        } else {
          tweenRef.current = 0;
          snap();
        }
      };
      cancelTween();
      tweenRef.current = requestAnimationFrame(fling);
    };

    scroller.addEventListener("pointerdown", onPointerDown);
    scroller.addEventListener("pointermove", onPointerMove);
    scroller.addEventListener("pointerup", finish);
    scroller.addEventListener("pointercancel", finish);
    return () => {
      scroller.removeEventListener("pointerdown", onPointerDown);
      scroller.removeEventListener("pointermove", onPointerMove);
      scroller.removeEventListener("pointerup", finish);
      scroller.removeEventListener("pointercancel", finish);
    };
  }, [snap]);

  // —— 倒数第二帧：后台预生成下一批 ——
  const preloadGuard = useRef<number>(-1);
  useEffect(() => {
    if (knownCount === 0 || generationBusy) return;
    if (frame < knownCount - 2) return;
    if (preloadGuard.current === knownCount) return;
    preloadGuard.current = knownCount;
    void onGenerate().catch(() => {
      preloadGuard.current = -1;
    });
  }, [frame, generationBusy, knownCount, onGenerate]);

  const totalSlots = knownCount + PENDING_SLOTS;
  const windowStart = Math.max(0, frame - WINDOW_RADIUS);
  const windowEnd = Math.min(totalSlots - 1, frame + WINDOW_RADIUS);
  const visibleSlots = useMemo(() => {
    const list: Array<{ index: number; candidate: CandidateFunnelItem | undefined }> = [];
    for (let i = windowStart; i <= windowEnd; i++) {
      list.push({ index: i, candidate: frames[i] });
    }
    return list;
  }, [frames, windowEnd, windowStart]);

  const leftSpacer = lead + windowStart * panelWidth;
  const rightSpacer = lead + (totalSlots - 1 - windowEnd) * panelWidth;

  const detail = detailIndex !== undefined ? frames[detailIndex] : undefined;

  const openFirstBatch = () => {
    void onGenerate();
  };

  return (
    <div className="ils" data-empty={knownCount === 0}>
      <div className="ils__scroller" ref={scrollerRef}>
        <div className="ils__track">
          <div className="ils__spacer" style={{ width: leftSpacer }} />
          {visibleSlots.map(({ index, candidate }) => (
            <article
              className={[
                "ils__panel",
                index === frame ? "is-center" : "",
                candidate ? "" : "is-pending",
              ].join(" ")}
              data-candidate-id={candidate?.id}
              key={index}
              onClick={() => {
                // 拖拽产生的 click 只用于消费抑制标记，不打开详情
                if (dragState.current.moved) {
                  dragState.current.moved = false;
                  return;
                }
                if (!candidate) return;
                setDetailIndex(index);
              }}
              style={{ width: panelWidth }}
            >
              {candidate ? (
                <>
                  <button
                    aria-label={candidate.stage === "inbox" ? "保留到基础候选" : "候选状态"}
                    className={[
                      "ils__keep",
                      candidate.stage === "inbox" ? "" : "is-kept",
                    ].join(" ")}
                    disabled={candidate.stage !== "inbox"}
                    onClick={(event) => {
                      event.stopPropagation();
                      void onFavorite(candidate.id);
                    }}
                    type="button"
                  >
                    {candidate.stage === "inbox" ? "留" : "候"}
                  </button>
                  <div className="ils__pinyin">
                    {candidate.pinyin.join(" · ").toUpperCase()}
                  </div>
                  <div className="ils__name brush-type">{candidate.fullName}</div>
                  <p className="ils__summary">{candidate.summary}</p>
                  <div className="ils__frame-no">
                    第 {String(index + 1).padStart(2, "0")} 帧
                  </div>
                </>
              ) : (
                <div className="ils__pending-inner">
                  <span className="ils__ink-dot" />
                  <em>研 墨 中</em>
                </div>
              )}
            </article>
          ))}
          <div className="ils__spacer" style={{ width: rightSpacer }} />
        </div>
      </div>

      {/* 空状态首屏 */}
      {knownCount === 0 ? (
        <div className="ils__welcome">
          <p className="ils__welcome-kicker">ERYA · 展 卷 寻 名</p>
          <h1 className="brush-type">为{profile.surname}姓宝宝<br />铺开第一卷</h1>
          <p>向右展卷，名字一帧帧落于纸上；滑到卷末，新墨已在身后研好。</p>
          <button
            className="ils__welcome-btn"
            disabled={generationBusy}
            onClick={openFirstBatch}
            type="button"
          >
            {generationBusy ? "正在研墨…" : "展卷 · 生成 9 个名字"}
          </button>
        </div>
      ) : null}

      {/* 底部坞：条件 / 民俗入口 + 操作提示 */}
      <footer className="ils__dock">
        <button onClick={() => setSidePanel("conditions")} type="button">
          调整条件
        </button>
        <button onClick={() => setSidePanel("folklore")} type="button">
          民俗设置
        </button>
        <span className="ils__dock-hint">滚轮展卷 · ← → 方向键 · 按住鼠标左右拖拽</span>
      </footer>

      {/* 侧滑面板：条件 / 民俗 */}
      <div
        className={["ils__sidepanel", sidePanel ? "is-open" : ""].join(" ")}
        aria-hidden={sidePanel === null}
      >
        <div className="ils__sidepanel-scrim" onClick={() => setSidePanel(null)} />
        <aside className="ils__sidepanel-card">
          <div className="ils__sidepanel-head">
            <strong>{sidePanel === "folklore" ? "民俗设置" : "起名条件"}</strong>
            <button onClick={() => setSidePanel(null)} type="button">
              ×
            </button>
          </div>
          <div className="ils__sidepanel-body">
            {sidePanel === "folklore" ? folkloreSettings : conditions}
          </div>
        </aside>
      </div>

      {/* 详情全屏层：继续点击任意处返回 */}
      {detail ? (
        <div
          className="ils__detail"
          onClick={() => setDetailIndex(undefined)}
          role="dialog"
          aria-modal="true"
          aria-label={`${detail.fullName}详情`}
        >
          <div className="ils__detail-inner">
            <div className="ils__detail-pinyin">
              {detail.pinyin.join(" · ").toUpperCase()}
            </div>
            <h2 className="ils__detail-name brush-type">{detail.fullName}</h2>
            <div className="ils__detail-explanation" onClick={(e) => e.stopPropagation()}>
              <NameExplanation
                candidate={detail}
                profile={profile}
                showFolklore={detail.stage === "folklore_review"}
              />
              {detail.stage === "inbox" ? (
                <button
                  className="ils__detail-keep"
                  onClick={() => void onFavorite(detail.id)}
                  type="button"
                >
                  保留到基础候选
                </button>
              ) : null}
            </div>
            <p className="ils__detail-back">继 续 点 击 任 意 处 返 回</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
