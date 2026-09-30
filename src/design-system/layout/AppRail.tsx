import "./app-rail.css";
import type { MouseEvent } from "react";
import { ThemeToggle } from "../ThemeToggle";

export interface AppRailItem {
  id: string;
  label: string;
  href: string;
}

export interface AppRailProps {
  activeId?: string;
  items: AppRailItem[];
  onNavigate?: (href: string) => void;
}

export function AppRail({ activeId, items, onNavigate }: AppRailProps) {
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.id === activeId),
  );

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
      <div className="app-rail__theme">
        <ThemeToggle />
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
              aria-current={item.id === activeId ? "page" : undefined}
              aria-label={item.label}
              className="app-rail__item"
              data-stage={
                index < activeIndex
                  ? "complete"
                  : index === activeIndex
                    ? "current"
                    : "upcoming"
              }
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
              <span aria-hidden="true" className="app-rail__step">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="app-rail__label">{item.label}</span>
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}
