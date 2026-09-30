import { Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { InkScene } from "../design-system/ink/InkScene";
import { AppRail, type AppRailItem } from "../design-system/layout/AppRail";
import { AppVersionWatcher } from "../features/app-update/AppVersionWatcher";
import { ERYA_DATABASE_VERSION } from "../infrastructure/database/EryaDatabase";
import "../design-system/primitives/primitives.css";
import { useApplicationContainer } from "./providers";

const railItems: AppRailItem[] = [
  { id: "projects", label: "方案中心", href: "/" },
  { id: "profile", label: "起名条件", href: "/projects/new/basic" },
  { id: "generate", label: "生名与初选", href: "/projects/demo/generate" },
  { id: "compare", label: "候选对比", href: "/projects/demo/compare" },
  { id: "finalize", label: "最终定稿", href: "/projects/demo/finalize" },
  { id: "backup", label: "备份与导出", href: "/projects/demo/backup" },
];

function activeRailId(pathname: string): string {
  if (pathname.includes("/generate")) return "generate";
  if (pathname.includes("/candidates")) return "generate";
  if (pathname.includes("/compare")) return "compare";
  if (pathname.includes("/finalize")) return "finalize";
  if (pathname.includes("/backup") || pathname === "/recovery") return "backup";
  if (pathname.includes("/new/")) return "profile";
  return "projects";
}

export function AppShell() {
  const container = useApplicationContainer();
  const router = useRouter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const projectId = pathname.match(/^\/projects\/([^/]+)/)?.[1];
  const scopedItems =
    projectId && projectId !== "new"
      ? railItems.map((item) => ({
          ...item,
          href:
            item.id === "profile"
              ? `/projects/${projectId}/generate#conditions`
              : item.href.replace("/demo/", `/${projectId}/`),
        }))
      : railItems.map((item) => ({
          ...item,
          href: ["projects", "profile"].includes(item.id)
            ? item.href
            : item.id === "backup"
              ? "/recovery"
              : "/projects/new/basic",
        }));

  return (
    <InkScene>
      <AppRail
        activeId={activeRailId(pathname)}
        items={scopedItems}
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
