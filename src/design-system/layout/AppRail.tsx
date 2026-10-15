import "./app-rail.css";
import { useEffect, useRef, type MouseEvent } from "react";

export interface AppRailItem {
  id: string;
  label: string;
  href: string;
  disabled?: boolean;
  availability?: "completed" | "available" | "blocked" | "optional" | "skipped";
}

export interface AppRailProps {
  activeId?: string;
  items: AppRailItem[];
  utilityItems?: AppRailItem[];
  onNavigate?: (href: string) => void;
}

export function AppRail({ activeId, items, utilityItems = [], onNavigate }: AppRailProps) {
  const activeItemRef = useRef<HTMLAnchorElement>(null);
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.id === activeId),
  );

  useEffect(() => {
    activeItemRef.current?.scrollIntoView?.({ block: "nearest", inline: "center" });
  }, [activeId]);

  return (
    <nav
      aria-label="方案工作区"
      className="app-rail"
      data-active-step={activeIndex + 1}
      style={{ width: "220px" }}
    >
      <div className="app-rail__brand">
        <span aria-hidden="true" className="app-rail__brand-mark">
          雅
        </span>
        <span className="app-rail__brand-copy">
          <strong>尔雅起名</strong>
          <small>一名一章 · 慎选所爱</small>
        </span>
      </div>
      <div className="app-rail__overlay">
        <div className="app-rail__progress">
          <span>命名旅程</span>
          <strong>
            第 {activeIndex + 1} / {items.length} 阶段
          </strong>
        </div>
        <div className="app-rail__journey">
          {items.map((item, index) => (
            <a
              aria-disabled={item.disabled || undefined}
              aria-current={item.id === activeId ? "page" : undefined}
              aria-label={item.label}
              className="app-rail__item"
              data-stage={
                index === activeIndex ? "current" : (item.availability ?? "available")
              }
              href={item.href}
              key={item.id}
              ref={item.id === activeId ? activeItemRef : undefined}
              tabIndex={item.disabled ? -1 : undefined}
              onClick={(event: MouseEvent<HTMLAnchorElement>) => {
                if (item.disabled) {
                  event.preventDefault();
                  return;
                }
                if (
                  !onNavigate ||
                  event.defaultPrevented ||
                  event.button !== 0 ||
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey
                )
                  return;

                event.preventDefault();
                onNavigate(item.href);
              }}
            >
              <span aria-hidden="true" className="app-rail__step">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="app-rail__label">{item.label}</span>
              {item.availability ? (
                <span aria-hidden="true" className="app-rail__state">
                  {
                    {
                      completed: "已完成",
                      available: "可继续",
                      blocked: "待处理",
                      optional: "可选",
                      skipped: "已跳过",
                    }[item.availability]
                  }
                </span>
              ) : null}
            </a>
          ))}
        </div>
        {utilityItems.length ? (
          <div className="app-rail__utilities" aria-label="方案工具">
            {utilityItems.map((item) => (
              <a
                aria-current={item.id === activeId ? "page" : undefined}
                href={item.href}
                key={item.id}
                onClick={(event: MouseEvent<HTMLAnchorElement>) => {
                  if (
                    !onNavigate ||
                    event.defaultPrevented ||
                    event.button !== 0 ||
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey
                  )
                    return;
                  event.preventDefault();
                  onNavigate(item.href);
                }}
              >
                {item.label}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </nav>
  );
}
