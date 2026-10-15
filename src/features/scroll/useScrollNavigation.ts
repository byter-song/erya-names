import { useEffect, useRef, useState } from "react";

/** Native touch scrolling; mouse capture starts only after an actual background drag. */
export function useScrollNavigation(count: number, identity: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(window.innerWidth);
  const [index, setIndex] = useState(0);
  const panelWidth = Math.min(Math.round(width * (width < 600 ? 0.88 : 0.72)), 760);
  const go = (next: number) => {
    const left = Math.max(0, Math.min(count - 1, next)) * panelWidth;
    ref.current?.scrollTo({
      left,
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  };
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (ref.current) ref.current.scrollLeft = 0;
    setIndex(0);
  }, [identity]);
  useEffect(() => {
    const next = Math.min(index, Math.max(0, count - 1));
    if (next !== index) {
      setIndex(next);
      if (ref.current) ref.current.scrollLeft = next * panelWidth;
    }
  }, [count, index, panelWidth]);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let drag: { x: number; left: number; moved: boolean } | undefined;
    let suppressClick = false;
    const scroll = () =>
      setIndex(Math.min(Math.max(0, count - 1), Math.round(element.scrollLeft / panelWidth)));
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY))
        return;
      event.preventDefault();
      element.scrollLeft +=
        event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? width : 1);
    };
    const down = (event: PointerEvent) => {
      if (
        event.pointerType !== "mouse" ||
        event.button !== 0 ||
        (event.target as HTMLElement).closest(
          "button, a, input, select, textarea, .ils__summary",
        )
      )
        return;
      event.preventDefault();
      drag = { x: event.clientX, left: element.scrollLeft, moved: false };
      suppressClick = false;
    };
    const move = (event: PointerEvent) => {
      if (!drag) return;
      if (!drag.moved && Math.abs(event.clientX - drag.x) < 6) return;
      if (!drag.moved) element.setPointerCapture(event.pointerId);
      drag.moved = true;
      element.scrollLeft = drag.left - event.clientX + drag.x;
    };
    const finish = (event: PointerEvent) => {
      suppressClick = Boolean(drag?.moved);
      drag = undefined;
      if (element.hasPointerCapture?.(event.pointerId))
        element.releasePointerCapture(event.pointerId);
    };
    const click = (event: MouseEvent) => {
      if (suppressClick) {
        event.preventDefault();
        event.stopPropagation();
        suppressClick = false;
      }
    };
    element.addEventListener("scroll", scroll, { passive: true });
    element.addEventListener("wheel", wheel, { passive: false });
    element.addEventListener("pointerdown", down);
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", finish);
    element.addEventListener("pointercancel", finish);
    element.addEventListener("click", click, true);
    return () => {
      element.removeEventListener("scroll", scroll);
      element.removeEventListener("wheel", wheel);
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", finish);
      element.removeEventListener("pointercancel", finish);
      element.removeEventListener("click", click, true);
    };
  }, [count, panelWidth, width]);
  return { ref, index, panelWidth, lead: Math.max(0, (width - panelWidth) / 2), go };
}
