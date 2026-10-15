import { Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type MouseEvent } from "react";
import { AppVersionWatcher } from "../features/app-update/AppVersionWatcher";
import { ERYA_DATABASE_VERSION } from "../infrastructure/database/EryaDatabase";
import type {
  JourneyAvailability,
  JourneyStageId,
} from "../application/use-cases/GetProjectJourneyView";
import { useApplicationContainer } from "./providers";
import "../design-system/primitives/primitives.css";
import "./InkScrollShell.css";

interface ShellChip {
  id: string;
  label: string;
  href: string;
  availability?: JourneyAvailability;
}

const setupChips: ShellChip[] = [
  { id: "projects", label: "方案长卷", href: "/" },
  { id: "profile", label: "起名条件", href: "/projects/new/basic" },
  { id: "backup", label: "备份与导出", href: "/recovery" },
];

function projectChips(
  projectId: string,
  availability?: Record<JourneyStageId, JourneyAvailability>,
): ShellChip[] {
  return [
    { id: "inbox", label: "灵感池", href: `/projects/${projectId}/generate#inbox` },
    { id: "basic", label: "基础候选", href: `/projects/${projectId}/generate#basic` },
    {
      id: "folklore",
      label: "民俗候选",
      href: `/projects/${projectId}/generate#folklore`,
    },
    { id: "compare", label: "重点候选", href: `/projects/${projectId}/compare` },
    { id: "finalize", label: "定稿名单", href: `/projects/${projectId}/finalize` },
    { id: "backup", label: "备份", href: `/projects/${projectId}/backup` },
  ].map((chip) => ({
    ...chip,
    ...(availability ? { availability: availability[chip.id as JourneyStageId] } : {}),
  }));
}

function activeChipId(pathname: string, hash: string): string {
  if (pathname.includes("/generate") || pathname.includes("/candidates")) {
    const stage = hash.replace(/^#/, "");
    if (stage === "conditions") return "inbox";
    return ["basic", "folklore"].includes(stage) ? stage : "inbox";
  }
  if (pathname.includes("/compare")) return "compare";
  if (pathname.includes("/finalize")) return "finalize";
  if (pathname.includes("/backup") || pathname === "/recovery") return "backup";
  if (pathname.includes("/new/")) return "profile";
  return "projects";
}

export function InkScrollShell() {
  const container = useApplicationContainer();
  const router = useRouter();
  const location = useRouterState({ select: (state) => state.location });
  const pathname = location.pathname;
  const projectId = pathname.match(/^\/projects\/([^/]+)/)?.[1];
  const hasProject = Boolean(projectId && projectId !== "new");
  const [journeyView, setJourneyView] = useState<
    Record<JourneyStageId, JourneyAvailability> | undefined
  >();

  useEffect(() => {
    if (!hasProject || !projectId) {
      setJourneyView(undefined);
      return;
    }
    const refresh = () => {
      void container.getProjectJourneyView?.execute(projectId).then(setJourneyView);
    };
    refresh();
    window.addEventListener("erya:journey-changed", refresh);
    return () => window.removeEventListener("erya:journey-changed", refresh);
  }, [container, hasProject, projectId]);

  const chips = hasProject ? projectChips(projectId!, journeyView) : setupChips;
  const activeId = activeChipId(pathname, location.hash);
  useEffect(() => {
    const revealActive = () => {
      const chip = document.querySelector<HTMLElement>(`[data-chip="${activeId}"]`);
      const nav = chip?.parentElement;
      if (!chip || !nav) return;
      const item = chip.getBoundingClientRect();
      const viewport = nav.getBoundingClientRect();
      if (item.left < viewport.left) nav.scrollLeft += item.left - viewport.left;
      else if (item.right > viewport.right) nav.scrollLeft += item.right - viewport.right;
    };
    revealActive();
    window.addEventListener("resize", revealActive);
    return () => window.removeEventListener("resize", revealActive);
  }, [activeId]);

  const navigate = (href: string) => void router.navigate({ href });
  const onChipClick = (event: MouseEvent<HTMLButtonElement>, href: string) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    navigate(href);
  };

  return (
    <div className="ink-shell" data-testid="ink-shell">
      <div aria-hidden="true" className="ink-shell__ambient">
        <span className="ink-shell__blob ink-shell__blob--ink" />
        <span className="ink-shell__blob ink-shell__blob--gold" />
        <span className="ink-shell__orbit">
          <i className="ink-shell__orbit-dot" />
        </span>
        <span className="ink-shell__mountains" />
        <span className="ink-shell__grain" />
      </div>

      <header className="ink-shell__hud">
        <button
          aria-label="返回方案长卷"
          className="ink-shell__brand brush-type"
          onClick={() => navigate("/")}
          type="button"
        >
          尔雅
          <small>一名一章 · 慎选所爱</small>
        </button>
        <nav aria-label="命名长卷阶段" className="ink-shell__chips">
          {chips.map((chip, index) => (
            <button
              aria-current={chip.id === activeId ? "page" : undefined}
              className={[
                "ink-shell__chip",
                chip.availability ? `is-${chip.availability}` : "",
              ].join(" ")}
              data-chip={chip.id}
              key={chip.id}
              onClick={(event) => onChipClick(event, chip.href)}
              type="button"
            >
              <span className="ink-shell__chip-no">{String(index + 1).padStart(2, "0")}</span>
              <span className="ink-shell__chip-label">{chip.label}</span>
            </button>
          ))}
        </nav>
      </header>

      <div className="ink-shell__content">
        <Outlet />
      </div>

      <AppVersionWatcher
        currentVersion={__APP_VERSION__}
        databaseVersion={ERYA_DATABASE_VERSION}
        prepareUpdate={async () => {
          const result = await container.prepareAppUpdate?.execute();
          if (!result?.ok) throw new Error(result?.error ?? "刷新前持久化服务未就绪");
        }}
      />
    </div>
  );
}
