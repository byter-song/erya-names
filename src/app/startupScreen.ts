interface StartupFailureActions {
  onRetry: () => void;
  onBrowse: () => void;
}

export interface StartupController {
  readonly element: HTMLElement;
  setProgress: (value: number) => void;
  exit: () => Promise<void>;
  fail: (actions: StartupFailureActions) => void;
}

type Phase = "drop" | "write" | "swirl" | "stamp" | "exit" | "error";

interface SwirlParticle {
  angle: number;
  baseRadius: number;
  speed: number;
  size: number;
  kind: "ink" | "gold";
  wobble: number;
  wobbleSpeed: number;
  seed: number;
  alpha: number;
}

interface Ribbon {
  yOffset: number;
  amp: number;
  freq: number;
  speed: number;
  width: number;
  alpha: number;
}

interface Drop {
  y: number;
  vy: number;
  size: number;
}

interface SplashDot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
}

interface Brush {
  // 沿时间线的关键位置由 phase 计算，这里存朝向
  angle: number;
}

// —— 时间线（毫秒）——
const T_WRITE_START = 820;
const T_WRITE_END = 2350;
const T_SWIRL_END = 3500;
const STAMP_MS = 560;
const EXIT_MS = 900;

const RING_C = 2 * Math.PI * 96;

export function createStartupScreen(): StartupController {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const screen = document.createElement("section");
  screen.className = "startup-screen";
  screen.setAttribute("role", "status");
  screen.setAttribute("aria-live", "polite");

  const grain = document.createElement("div");
  grain.className = "startup-screen__grain";
  grain.setAttribute("aria-hidden", "true");

  const canvas = document.createElement("canvas");
  canvas.className = "startup-screen__canvas";
  canvas.setAttribute("aria-hidden", "true");

  const center = document.createElement("div");
  center.className = "startup-screen__center";
  center.innerHTML = `
    <svg class="ss-ring" viewBox="0 0 240 240" aria-hidden="true">
      <circle class="ss-ring__halo" cx="120" cy="120" r="113" />
      <circle class="ss-ring__track" cx="120" cy="120" r="96" />
      <circle class="ss-ring__ticks" cx="120" cy="120" r="105" />
      <circle class="ss-ring__progress" cx="120" cy="120" r="96" />
    </svg>
    <svg class="ss-brand" viewBox="0 0 160 92" aria-hidden="true">
      <text x="80" y="74" text-anchor="middle">尔雅</text>
    </svg>
    <span class="ss-percent">0%</span>
    <div class="startup-screen__phase">落 墨</div>
    <div class="startup-screen__sub">INK FALLS</div>
  `;

  const wash = document.createElement("div");
  wash.className = "startup-screen__wash";
  wash.setAttribute("aria-hidden", "true");

  // 朱砂印章
  const seal = document.createElement("div");
  seal.className = "ss-seal";
  seal.setAttribute("aria-hidden", "true");
  seal.innerHTML = `<span class="ss-seal__box brush-type">尔雅</span><span class="ss-seal__ripple" />`;

  screen.append(grain, canvas, center, wash, seal);

  const ringProgress = center.querySelector<SVGCircleElement>(".ss-ring__progress")!;
  const percentEl = center.querySelector<HTMLElement>(".ss-percent")!;
  const phaseEl = center.querySelector<HTMLElement>(".startup-screen__phase")!;
  const subEl = center.querySelector<HTMLElement>(".startup-screen__sub")!;
  ringProgress.style.strokeDasharray = String(RING_C);
  ringProgress.style.strokeDashoffset = String(RING_C);

  // —— Canvas 状态 ——
  const ctx = canvas.getContext("2d")!;
  let W = 0;
  let H = 0;

  const swirl: SwirlParticle[] = [];
  const ribbons: Ribbon[] = [
    { yOffset: -0.26, amp: 26, freq: 0.0042, speed: 0.9, width: 9, alpha: 0.12 },
    { yOffset: 0.2, amp: 34, freq: 0.003, speed: 0.6, width: 13, alpha: 0.09 },
    { yOffset: 0.02, amp: 15, freq: 0.006, speed: 1.2, width: 5, alpha: 0.11 },
  ];

  const drop: Drop = { y: 0, vy: 0, size: 15 };
  let splashed = false;
  let splashAt = 0;
  let splashDots: SplashDot[] = [];
  let inkSpread = 0;

  const brush: Brush = { angle: -0.6 };
  let brushInkDots: Array<{ x: number; y: number; r: number; a: number }> = [];

  let zoom = 1;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drop.y = H * 0.14;
  }

  function spawnSwirl() {
    swirl.length = 0;
    const unit = Math.min(W, H);
    const minR = unit * 0.17;
    for (let i = 0; i < 118; i++) {
      const kind: SwirlParticle["kind"] = i < 82 ? "ink" : "gold";
      swirl.push({
        angle: Math.random() * Math.PI * 2,
        baseRadius:
          kind === "ink"
            ? minR + Math.random() * unit * 0.32
            : minR * 0.7 + Math.random() * unit * 0.26,
        speed: 0.1 + Math.random() * 0.5,
        size: kind === "gold" ? 0.8 + Math.random() * 1.7 : 0.6 + Math.random() * 2.3,
        kind,
        wobble: 6 + Math.random() * 20,
        wobbleSpeed: 0.4 + Math.random() * 1.1,
        seed: Math.random() * Math.PI * 2,
        alpha: kind === "gold" ? 0.5 + Math.random() * 0.4 : 0.26 + Math.random() * 0.4,
      });
    }
  }

  resize();
  spawnSwirl();
  window.addEventListener("resize", () => {
    resize();
    spawnSwirl();
  });

  // —— 演示进度时间线：保证每次都能看完整段动画 ——
  function demoProgress(t: number): number {
    if (t < T_WRITE_START) return 0.04 + (t / T_WRITE_START) * 0.08;
    if (t < T_WRITE_END)
      return 0.12 + ((t - T_WRITE_START) / (T_WRITE_END - T_WRITE_START)) * 0.43;
    if (t < T_SWIRL_END)
      return 0.55 + ((t - T_WRITE_END) / (T_SWIRL_END - T_WRITE_END)) * 0.39;
    return 0.96;
  }

  let phase: Phase = "drop";
  let realProgress = 0;
  let ready = false;
  let stampStart = 0;
  let exitStart = 0;
  let resolveExit: (() => void) | undefined;
  let lastPhaseLabel = "";

  function setPhaseLabel(label: string, sub: string) {
    if (label === lastPhaseLabel) return;
    lastPhaseLabel = label;
    phaseEl.textContent = label;
    subEl.textContent = sub;
  }

  // 毛笔尖端轨迹：飞入 → 写“尔” → 写“雅” → 飞出
  function brushTip(t: number): { x: number; y: number; drawing: boolean } {
    const cx = W / 2;
    const cy = H / 2;
    if (t < T_WRITE_START) {
      const k = t / T_WRITE_START;
      const e = 1 - Math.pow(1 - k, 2.2);
      return {
        x: W * 0.92 + (cx - 78 - W * 0.92) * e,
        y: H * 0.1 + (cy + 18 - H * 0.1) * e,
        drawing: false,
      };
    }
    if (t < T_WRITE_END) {
      const k = (t - T_WRITE_START) / (T_WRITE_END - T_WRITE_START);
      // 两个字各一条微摆的横向轨迹
      const half = k < 0.5 ? k * 2 : (k - 0.5) * 2;
      const x0 = k < 0.5 ? cx - 78 : cx + 2;
      const x1 = k < 0.5 ? cx - 8 : cx + 72;
      return {
        x: x0 + (x1 - x0) * half,
        y: cy + 14 - Math.sin(half * Math.PI) * 16 + (k < 0.5 ? 0 : 2),
        drawing: true,
      };
    }
    const k = Math.min(1, (t - T_WRITE_END) / 260);
    const e = k * k;
    return {
      x: cx + 72 + (W * 0.95 - (cx + 72)) * e,
      y: cy + 16 + (H * 0.08 - (cy + 16)) * e,
      drawing: false,
    };
  }

  function drawDrop(t: number) {
    const cx = W / 2;
    const cy = H / 2;

    if (!splashed) {
      drop.vy += 0.85;
      drop.y += drop.vy;
      // 墨滴本体（下坠时纵向微拉伸，拖尾由画布淡入淡出自然形成）
      const stretch = 1 + Math.min(0.55, drop.vy * 0.03);
      ctx.save();
      ctx.translate(cx, drop.y);
      ctx.scale(0.92, stretch);
      ctx.fillStyle = "#232620";
      ctx.beginPath();
      ctx.arc(0, 0, drop.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (drop.y >= cy) {
        splashed = true;
        splashAt = t;
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI + (i / 9) * Math.PI + (Math.random() - 0.5) * 0.5;
          const sp = 3 + Math.random() * 5;
          splashDots.push({
            x: cx,
            y: cy,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp - 1.5,
            size: 2 + Math.random() * 4,
            life: 1,
          });
        }
      }
      return;
    }

    // 墨晕在宣纸轻晕开（克制，不压过书法）
    const age = t - splashAt;
    inkSpread = Math.min(1, age / 520);
    const r = 34 + inkSpread * 72;
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
    g.addColorStop(0, "rgba(35,38,32,0.085)");
    g.addColorStop(0.7, "rgba(35,38,32,0.035)");
    g.addColorStop(1, "rgba(35,38,32,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    if (inkSpread < 1) {
      ctx.strokeStyle = `rgba(35,38,32,${(1 - inkSpread) * 0.4})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    splashDots = splashDots.filter((d) => d.life > 0.02);
    for (const d of splashDots) {
      d.vy += 0.28;
      d.x += d.vx;
      d.y += d.vy;
      d.life -= 0.018;
      if (d.life <= 0) continue;
      ctx.fillStyle = `rgba(35,38,32,${d.life * 0.75})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.size * d.life, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBrush(t: number) {
    const tip = brushTip(t);
    const prev = brushTip(Math.max(0, t - 24));
    const dx = tip.x - prev.x;
    const dy = tip.y - prev.y;
    if (Math.hypot(dx, dy) > 0.1) brush.angle = Math.atan2(dy, dx);

    // 运笔落墨：在纸面留下墨点，稍后淡去
    if (tip.drawing && Math.random() < 0.5)
      brushInkDots.push({ x: tip.x, y: tip.y, r: 2 + Math.random() * 3, a: 0.4 });
    brushInkDots = brushInkDots.filter((d) => {
      d.a -= 0.008;
      return d.a > 0;
    });
    for (const d of brushInkDots) {
      ctx.fillStyle = `rgba(35,38,32,${d.a})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 毛笔本体：笔杆 + 笔锋
    ctx.save();
    ctx.translate(tip.x, tip.y);
    ctx.rotate(brush.angle);
    const L = 118;
    // 笔杆（从尖端向后，即 -x）
    const rod = ctx.createLinearGradient(-L, 0, -26, 0);
    rod.addColorStop(0, "#c9a86a");
    rod.addColorStop(1, "#e7d3a4");
    ctx.fillStyle = rod;
    ctx.fillRect(-L, -4.5, L - 30, 9);
    ctx.strokeStyle = "rgba(90,66,30,0.6)";
    ctx.lineWidth = 1;
    ctx.strokeRect(-L, -4.5, L - 30, 9);
    // 笔斗 + 笔锋（锥形深色）
    ctx.fillStyle = "#8a5a2b";
    ctx.beginPath();
    ctx.moveTo(-30, -7);
    ctx.lineTo(-14, -5);
    ctx.lineTo(-14, 5);
    ctx.lineTo(-30, 7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = tip.drawing ? "#15170f" : "#232620";
    ctx.beginPath();
    ctx.moveTo(-14, -5);
    ctx.quadraticCurveTo(2, -3.4, 10, 0);
    ctx.quadraticCurveTo(2, 3.4, -14, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawRibbons(now: number, z: number) {
    for (const rb of ribbons) {
      const scroll = (now * 0.04 * rb.speed) % (W + 400);
      ctx.beginPath();
      const startX = -200 + scroll;
      for (let x = 0; x <= W + 400; x += 24) {
        const wx = startX + x;
        const wy =
          H / 2 +
          rb.yOffset * H +
          Math.sin(wx * rb.freq + now * 0.001 * rb.speed) * rb.amp * z;
        if (x === 0) ctx.moveTo(wx, wy);
        else ctx.lineTo(wx, wy);
      }
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = rb.width;
      ctx.strokeStyle = `rgba(35,38,32,${rb.alpha * Math.max(0, 1.3 - z * 0.45)})`;
      ctx.shadowBlur = 8;
      ctx.shadowColor = "rgba(35,38,32,0.2)";
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  function drawSwirl(now: number, progress: number, z: number, burst: boolean) {
    const cx = W / 2;
    const cy = H / 2;
    const swirlPower = 0.35 + progress * 1.9;
    for (const pass of ["ink", "gold"] as const) {
      ctx.globalCompositeOperation = pass === "gold" ? "lighter" : "source-over";
      for (const p of swirl) {
        if (p.kind !== pass) continue;
        p.angle += (p.speed * 0.01 * swirlPower) / Math.max(0.4, z);
        const wobble = Math.sin(now * 0.001 * p.wobbleSpeed + p.seed) * p.wobble;
        const radius = (p.baseRadius + wobble) * (burst ? z : z * (1 - progress * 0.1));
        const x = cx + Math.cos(p.angle) * radius;
        const y = cy + Math.sin(p.angle) * radius * (burst ? 1 : 0.92);
        const twinkle =
          p.kind === "gold" ? 0.55 + Math.sin(now * 0.004 + p.seed) * 0.45 : 1;
        const alpha = p.alpha * twinkle * Math.max(0, 1.4 - z * 0.3);
        ctx.fillStyle =
          p.kind === "gold"
            ? `rgba(201,156,88,${alpha})`
            : `rgba(35,38,32,${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }

  let raf = 0;
  const start0 = performance.now();

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    try {
      frameBody(now);
    } catch (error) {
      (window as unknown as { __frameError?: string }).__frameError = String(
        error instanceof Error ? error.message + "\n" + error.stack : error,
      );
    }
  }

  function frameBody(now: number) {
    const t = now - start0;

    // —— 状态推进 ——
    if (phase !== "error" && phase !== "stamp" && phase !== "exit") {
      if (t < T_WRITE_START) {
        phase = "drop";
        setPhaseLabel("落 墨", "INK FALLS");
      } else if (t < T_WRITE_END) {
        phase = "write";
        setPhaseLabel("运 笔", "BRUSH WRITES");
      } else if (ready && t >= T_SWIRL_END) {
        phase = "stamp";
        stampStart = now;
        setPhaseLabel("钤 印", "SEALING");
      } else {
        phase = "swirl";
        setPhaseLabel("成 章", "INK SETTLES");
      }
    }

    if (phase === "stamp") {
      screen.classList.add("is-stamping");
      const st = now - stampStart;
      if (st >= STAMP_MS) {
        phase = "exit";
        exitStart = now;
        screen.classList.remove("is-stamping");
        screen.classList.add("is-exiting");
      }
    }

    let burst = false;
    if (phase === "exit") {
      setPhaseLabel("展 卷", "THE SCROLL OPENS");
      const k = Math.min(1, (now - exitStart) / EXIT_MS);
      zoom = 1 + k * k * 5.2;
      burst = true;
      if (k >= 1) {
        cancelAnimationFrame(raf);
        resolveExit?.();
        resolveExit = undefined;
        return;
      }
    } else {
      zoom = 1;
    }

    const demo = demoProgress(Math.min(t, T_SWIRL_END));
    const progress = phase === "exit" || phase === "stamp" ? 1 : Math.max(demo, realProgress * 0);
    // 视觉以演示时间线为准；真实进度只决定“是否可退场”

    // 较高不透明度的纸色覆盖：下落墨滴只留短彗尾，避免残帧堆叠成柱
    ctx.fillStyle = "rgba(253,251,244,0.42)";
    ctx.fillRect(0, 0, W, H);

    drawRibbons(now, zoom);
    drawDrop(t);
    // 毛笔只在落墨结束后入场、书写结束后离场
    if (splashed && t < T_WRITE_END + 260) drawBrush(t);
    drawSwirl(now, progress, zoom, burst);

    const shown = phase === "stamp" || phase === "exit" ? 1 : progress;
    ringProgress.style.strokeDashoffset = String(RING_C * (1 - shown));
    percentEl.textContent = `${Math.round(shown * 100)}%`;
  }

  if (reduced) {
    // 减弱动效：直接静态终态，等待 exit
    ringProgress.style.strokeDashoffset = "0";
    percentEl.textContent = "100%";
  } else {
    raf = requestAnimationFrame(frame);
  }

  return {
    element: screen,

    setProgress(value) {
      realProgress = Math.max(realProgress, Math.min(1, value));
    },

    exit() {
      ready = true;
      if (reduced) return new Promise((r) => setTimeout(r, 120));
      return new Promise((resolve) => {
        resolveExit = resolve;
      });
    },

    fail(actions) {
      phase = "error";
      screen.classList.add("startup-screen--error");
      const card = document.createElement("div");
      card.className = "startup-screen__error-card";
      card.innerHTML = `
        <strong>起名资料暂时未能载入</strong>
        <p>已有方案仍保存在本机，数据未被修改。请确认本地服务正常后重试，或直接打开已有方案与备份。</p>
      `;
      const wrap = document.createElement("div");
      wrap.className = "startup-screen__error-actions";
      const retry = document.createElement("button");
      retry.type = "button";
      retry.dataset.action = "retry";
      retry.textContent = "重新载入";
      retry.addEventListener("click", actions.onRetry);
      const browse = document.createElement("button");
      browse.type = "button";
      browse.dataset.action = "browse";
      browse.textContent = "打开已有方案与备份";
      browse.addEventListener("click", actions.onBrowse);
      wrap.append(retry, browse);
      card.append(wrap);
      center.replaceChildren(card);
    },
  };
}
