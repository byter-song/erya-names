import { createPortal } from "react-dom";
import { useEffect, useRef, type PropsWithChildren } from "react";

export function Dialog({
  children,
  title,
  onClose,
  closeLabel = "关闭",
}: PropsWithChildren<{ title: string; onClose?: () => void; closeLabel?: string }>) {
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
  useEffect(() => {
    // A focused action can lose focus when it is disabled during an async save.
    // Keep Escape working for the top modal even if focus temporarily falls to body.
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const modals = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      if (modals[modals.length - 1] !== dialog.current) return;
      event.preventDefault();
      onClose?.();
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [onClose]);
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
    ].filter((element) => {
      if (element.closest("[hidden], [inert]")) return false;
      for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
        if (ancestor instanceof HTMLDetailsElement && !ancestor.open) {
          const summary = ancestor.querySelector(":scope > summary");
          if (!summary?.contains(element)) return false;
        }
      }
      return true;
    });
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
        <header className="ui-dialog__heading">
          <h2>{title}</h2>
          {onClose && (
            <button type="button" onClick={onClose}>
              {closeLabel}
            </button>
          )}
        </header>
        <div className="ui-dialog__body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
