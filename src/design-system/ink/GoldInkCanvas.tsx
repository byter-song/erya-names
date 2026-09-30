import { useEffect, useRef } from "react";

interface InkDrop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
  maxLife: number;
  gold: boolean;
  seed: number;
  impact?: boolean;
}

function randomFactory(initialSeed: number) {
  let seed = initialSeed >>> 0;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function drawBlot(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  gold: boolean,
  opacity: number,
  seed: number,
) {
  const random = randomFactory(seed);
  const points = 26;
  context.save();
  context.globalCompositeOperation = "multiply";
  context.beginPath();
  for (let index = 0; index < points; index += 1) {
    const angle = (Math.PI * 2 * index) / points;
    const distance = radius * (0.74 + random() * 0.38);
    const px = x + Math.cos(angle) * distance;
    const py = y + Math.sin(angle) * distance;
    if (index === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  }
  context.closePath();
  const gradient = context.createRadialGradient(x, y, radius * 0.06, x, y, radius * 1.12);
  if (gold) {
    gradient.addColorStop(0, `rgba(235, 183, 72, ${opacity})`);
    gradient.addColorStop(0.58, `rgba(194, 126, 24, ${opacity * 0.62})`);
    gradient.addColorStop(1, "rgba(153, 92, 13, 0)");
  } else {
    gradient.addColorStop(0, `rgba(17, 13, 9, ${opacity})`);
    gradient.addColorStop(0.6, `rgba(38, 27, 16, ${opacity * 0.52})`);
    gradient.addColorStop(1, "rgba(31, 21, 12, 0)");
  }
  context.fillStyle = gradient;
  context.fill();
  context.restore();
}

function drawStaticInk(context: CanvasRenderingContext2D, width: number, height: number) {
  drawBlot(
    context,
    width * 0.86,
    height * 0.2,
    Math.min(width, height) * 0.09,
    true,
    0.24,
    501,
  );
  drawBlot(
    context,
    width * 0.95,
    height * 0.54,
    Math.min(width, height) * 0.12,
    false,
    0.17,
    777,
  );
  drawBlot(
    context,
    width * 0.13,
    height * 0.89,
    Math.min(width, height) * 0.1,
    false,
    0.18,
    990,
  );

  const random = randomFactory(20260929);
  context.save();
  context.globalCompositeOperation = "multiply";
  for (let index = 0; index < 72; index += 1) {
    const clusterRight = index < 52;
    const x = clusterRight
      ? width * (0.69 + random() * 0.31)
      : width * (0.03 + random() * 0.28);
    const y = clusterRight
      ? height * (0.04 + random() * 0.62)
      : height * (0.62 + random() * 0.34);
    const radius = 0.7 + random() * (index % 9 === 0 ? 7 : 3.2);
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle =
      index % 5 === 0
        ? `rgba(24, 17, 10, ${0.12 + random() * 0.2})`
        : `rgba(211, 151, 39, ${0.18 + random() * 0.32})`;
    context.fill();
  }
  context.restore();
}

function drawLivingStroke(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
) {
  const breath = (Math.sin(time * 0.00072) + 1) / 2;
  drawBlot(
    context,
    width * 0.84 + Math.sin(time * 0.00021) * 18,
    height * 0.18 + Math.cos(time * 0.00018) * 9,
    Math.min(width, height) * (0.035 + breath * 0.018),
    true,
    0.07 + breath * 0.045,
    1847,
  );
  drawBlot(
    context,
    width * 0.11 + Math.cos(time * 0.00016) * 13,
    height * 0.84,
    Math.min(width, height) * (0.026 + (1 - breath) * 0.012),
    false,
    0.045 + (1 - breath) * 0.026,
    2903,
  );
}

function drawDrop(context: CanvasRenderingContext2D, drop: InkDrop) {
  const progress = 1 - drop.life / drop.maxLife;
  const alpha =
    Math.sin(Math.PI * Math.min(1, progress)) *
    (drop.impact ? (drop.gold ? 0.9 : 0.68) : drop.gold ? 0.56 : 0.32);
  const radius = drop.radius * (drop.impact ? 0.95 + progress * 2.1 : 0.72 + progress * 1.45);
  const gradient = context.createRadialGradient(drop.x, drop.y, 0, drop.x, drop.y, radius);
  if (drop.gold) {
    gradient.addColorStop(0, `rgba(244, 199, 90, ${alpha})`);
    gradient.addColorStop(0.44, `rgba(204, 137, 31, ${alpha * 0.7})`);
    gradient.addColorStop(1, "rgba(178, 104, 18, 0)");
  } else {
    gradient.addColorStop(0, `rgba(12, 9, 6, ${alpha})`);
    gradient.addColorStop(0.55, `rgba(35, 24, 14, ${alpha * 0.55})`);
    gradient.addColorStop(1, "rgba(26, 18, 10, 0)");
  }
  context.save();
  context.globalCompositeOperation = "multiply";
  context.fillStyle = gradient;
  context.beginPath();
  const random = randomFactory(drop.seed);
  const points = drop.impact ? 24 : 14;
  for (let index = 0; index < points; index += 1) {
    const angle = (Math.PI * 2 * index) / points;
    const edge = radius * (0.7 + random() * (drop.impact ? 0.54 : 0.28));
    const x = drop.x + Math.cos(angle) * edge;
    const y = drop.y + Math.sin(angle) * edge * (0.78 + (drop.seed % 5) * 0.04);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
  context.fill();
  context.restore();
}

export function GoldInkCanvas({ disabled }: { disabled: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const splashCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const splashCanvas = splashCanvasRef.current;
    if (!canvas || !splashCanvas || typeof window.CanvasRenderingContext2D === "undefined")
      return;
    const backgroundCanvas = canvas;
    const foregroundCanvas = splashCanvas;
    const context = canvas.getContext("2d", { alpha: true });
    const splashContext = splashCanvas.getContext("2d", { alpha: true });
    if (!context || !splashContext) return;

    const staticCanvas = document.createElement("canvas");
    const staticContext = staticCanvas.getContext("2d", { alpha: true });
    if (!staticContext) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const drops: InkDrop[] = [];
    let frame = 0;
    let startTimer = 0;
    let running = false;
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let previousTime = 0;
    let previousFrameTime = 0;
    let lastPointerX = -100;
    let lastPointerY = -100;
    let ambientSeed = 1;

    const renderStatic = () => {
      staticContext.setTransform(1, 0, 0, 1, 0, 0);
      staticContext.clearRect(0, 0, staticCanvas.width, staticCanvas.height);
      staticContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      drawStaticInk(staticContext, width, height);
    };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.floor(width * pixelRatio));
      canvas.height = Math.max(1, Math.floor(height * pixelRatio));
      splashCanvas.width = canvas.width;
      splashCanvas.height = canvas.height;
      staticCanvas.width = canvas.width;
      staticCanvas.height = canvas.height;
      renderStatic();
    };

    const paintFrame = (time: number, animate: boolean) => {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(staticCanvas, 0, 0);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      if (animate) drawLivingStroke(context, width, height, time);
      splashContext.setTransform(1, 0, 0, 1, 0, 0);
      splashContext.clearRect(0, 0, splashCanvas.width, splashCanvas.height);
      splashContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      drops.forEach((drop) => drawDrop(splashContext, drop));
    };

    const spawn = (x: number, y: number, count: number, forceGold?: boolean) => {
      const random = randomFactory(ambientSeed * 97 + Math.round(x * 11 + y * 17));
      ambientSeed += 1;
      for (let index = 0; index < count; index += 1) {
        const angle = random() * Math.PI * 2;
        const velocity = 0.08 + random() * (count > 4 ? 0.56 : 0.22);
        const maxLife = 900 + random() * 1700;
        drops.push({
          x: x + (random() - 0.5) * (count > 4 ? 24 : 9),
          y: y + (random() - 0.5) * (count > 4 ? 24 : 9),
          vx: Math.cos(angle) * velocity,
          vy: Math.sin(angle) * velocity + 0.025,
          radius: 1.8 + random() * (count > 4 ? 9 : 4.6),
          life: maxLife,
          maxLife,
          gold: forceGold ?? random() > 0.2,
          seed: Math.floor(random() * 1000),
        });
      }
      if (drops.length > 120) drops.splice(0, drops.length - 120);
    };

    const pointerMove = (event: PointerEvent) => {
      if (disabled || reducedMotion.matches) return;
      const distance = Math.hypot(event.clientX - lastPointerX, event.clientY - lastPointerY);
      if (distance < 18) return;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      startAnimating();
      spawn(event.clientX, event.clientY, 2, true);
    };

    const pointerDown = (event: PointerEvent) => {
      if (disabled || reducedMotion.matches) return;
      startAnimating();
      spawn(event.clientX, event.clientY, 30);
      drops.push({
        x: event.clientX,
        y: event.clientY,
        vx: 0,
        vy: 0.008,
        radius: 48 + (ambientSeed % 4) * 4,
        life: 1600,
        maxLife: 1600,
        gold: true,
        seed: ambientSeed * 31,
        impact: true,
      });
      drops.push({
        x: event.clientX - 7,
        y: event.clientY + 5,
        vx: -0.008,
        vy: 0.012,
        radius: 22 + (ambientSeed % 3) * 3,
        life: 1450,
        maxLife: 1450,
        gold: false,
        seed: ambientSeed * 43,
        impact: true,
      });
    };

    const animate = (time: number) => {
      if (time - previousFrameTime < 32) {
        frame = requestAnimationFrame(animate);
        return;
      }
      previousFrameTime = time;
      const delta = previousTime ? Math.min(50, time - previousTime) : 16;
      previousTime = time;
      if (time % 820 < delta && drops.length < 78) {
        spawn(width * (0.7 + ((ambientSeed * 0.137) % 0.27)), height * 0.18, 2, true);
      }
      for (let index = drops.length - 1; index >= 0; index -= 1) {
        const drop = drops[index]!;
        drop.life -= delta;
        drop.x += drop.vx * delta;
        drop.y += drop.vy * delta;
        drop.vx *= 0.993;
        drop.vy *= 0.993;
        if (drop.life <= 0) drops.splice(index, 1);
      }
      paintFrame(time, true);
      frame = requestAnimationFrame(animate);
    };

    function startAnimating() {
      if (running || disabled || reducedMotion.matches) return;
      running = true;
      backgroundCanvas.dataset.rendering = "active";
      foregroundCanvas.dataset.rendering = "active";
      frame = requestAnimationFrame(animate);
    }

    const restart = () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(startTimer);
      running = false;
      previousTime = 0;
      previousFrameTime = 0;
      canvas.dataset.rendering = "static";
      splashCanvas.dataset.rendering = "static";
      paintFrame(0, false);
      if (!disabled && !reducedMotion.matches) {
        // Keep first paint quiet. Pointer interaction starts immediately; otherwise
        // ambient ink begins after the page has settled.
        startTimer = window.setTimeout(startAnimating, 4000);
      }
    };

    resize();
    restart();
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("pointermove", pointerMove, { passive: true });
    window.addEventListener("pointerdown", pointerDown, { passive: true });
    reducedMotion.addEventListener("change", restart);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(startTimer);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", pointerMove);
      window.removeEventListener("pointerdown", pointerDown);
      reducedMotion.removeEventListener("change", restart);
    };
  }, [disabled]);

  return (
    <>
      <canvas
        aria-hidden="true"
        className="ink-scene__gold-canvas ink-scene__gold-canvas--background"
        data-motion={disabled ? "static" : "active"}
        data-testid="gold-ink-canvas"
        ref={canvasRef}
      />
      <canvas
        aria-hidden="true"
        className="ink-scene__gold-canvas ink-scene__gold-canvas--splash"
        data-motion={disabled ? "static" : "active"}
        data-testid="gold-ink-splash-canvas"
        ref={splashCanvasRef}
      />
    </>
  );
}
