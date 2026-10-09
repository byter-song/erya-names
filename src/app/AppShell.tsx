import { Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { InkScene } from "../design-system/ink/InkScene";
import { AppRail, type AppRailItem } from "../design-system/layout/AppRail";
import { AppVersionWatcher } from "../features/app-update/AppVersionWatcher";
import { ERYA_DATABASE_VERSION } from "../infrastructure/database/EryaDatabase";
import "../design-system/primitives/primitives.css";
import { useApplicationContainer } from "./providers";
import { useEffect, useState } from "react";
import type {
  JourneyAvailability,
  JourneyStageId,
} from "../application/use-cases/GetProjectJourneyView";

const setupRailItems: AppRailItem[] = [
  { id: "projects", label: "方案中心", href: "/" },
  { id: "profile", label: "起名条件", href: "/projects/new/basic" },
  { id: "backup", label: "备份与导出", href: "/recovery" },
];

function projectJourneyItems(
  projectId: string,
  availability?: Record<JourneyStageId, JourneyAvailability>,
): AppRailItem[] {
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
  ].map((item) => ({
    ...item,
    ...(availability ? { availability: availability[item.id as JourneyStageId] } : {}),
  }));
}

function activeRailId(pathname: string, hash: string): string {
  if (pathname.includes("/generate") || pathname.includes("/candidates")) {
    const stage = hash.replace(/^#/, "");
    return ["basic", "folklore"].includes(stage) ? stage : "inbox";
  }
  if (pathname.includes("/compare")) return "compare";
  if (pathname.includes("/finalize")) return "finalize";
  if (pathname.includes("/backup") || pathname === "/recovery") return "backup";
  if (pathname.includes("/new/")) return "profile";
  return "projects";
}

export function AppShell() {
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
  const scopedItems = hasProject
    ? projectJourneyItems(projectId!, journeyView)
    : setupRailItems;
  const utilityItems = hasProject
    ? [
        { id: "projects", label: "方案中心", href: "/" },
        {
          id: "profile",
          label: "调整条件",
          href: `/projects/${projectId}/generate#conditions`,
        },
        { id: "backup", label: "备份与导出", href: `/projects/${projectId}/backup` },
      ]
    : [];

  return (
    <InkScene>
      <AppRail
        activeId={activeRailId(pathname, location.hash)}
        items={scopedItems}
        utilityItems={utilityItems}
        onNavigate={(href) => void router.navigate({ href })}
      />
      <Outlet />
      <AppVersionWatcher
        currentVersion={__APP_VERSION__}
        databaseVersion={ERYA_DATABASE_VERSION}
        prepareUpdate={async () => {
          const result = await container.prepareAppUpdate?.execute();
          if (!result?.ok) throw new Error(result?.error ?? "刷新前持久化服务未就绪");
        }}
      />
    </InkScene>
  );
}
