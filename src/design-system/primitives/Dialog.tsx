import { createPortal } from "react-dom";
import { useEffect, useRef, type PropsWithChildren } from "react";

export function Dialog({
  children,
  title,
  onClose,
}: PropsWithChildren<{ title: string; onClose?: () => void }>) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = document.getElementById("root");
    const wasInert = root?.inert ?? false;
    const overflow = document.body.style.overflow;
    if (root) root.inert = true;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    return () => {
      if (root) root.inert = wasInert;
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose?.();
      return;
    }
    if (event.key !== "Tab" || !dialog.current) return;
    const focusable = [
      ...dialog.current.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], summary",
      ),
    ];
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable.at(-1)!;
    if (
      event.shiftKey &&
      (document.activeElement === first || document.activeElement === dialog.current)
    ) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  return createPortal(
    <div className="dialog-backdrop">
      <div
        aria-label={title}
        aria-modal="true"
        className="ui-dialog"
        ref={dialog}
        role="dialog"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <h2>{title}</h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}
