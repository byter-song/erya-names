import { Button } from "../../design-system/primitives/Button";
import { useState } from "react";
import "./app-update.css";

export interface AppUpdatePromptProps {
  currentVersion: string;
  latestVersion: string;
  refresh: () => Promise<void>;
  compatible?: boolean;
}

export function AppUpdatePrompt({
  currentVersion,
  latestVersion,
  refresh,
  compatible = true,
}: AppUpdatePromptProps) {
  const [error, setError] = useState("");
  if (currentVersion === latestVersion) {
    return null;
  }

  return (
    <aside aria-label="应用更新" className="app-update">
      <div>
        <strong>新版本 {latestVersion} 已发布</strong>
        {compatible ? (
          <p>建议先下载项目备份，再刷新应用。浏览器中的方案数据不会被自动清除。</p>
        ) : (
          <p>新版本暂不兼容当前本地数据，请先导出备份并按发布说明完成迁移。</p>
        )}
      </div>
      {compatible ? (
        <Button
          onClick={() => {
            setError("");
            void refresh().catch((reason: unknown) =>
              setError(reason instanceof Error ? reason.message : "刷新前保存失败"),
            );
          }}
          type="button"
        >
          备份后刷新
        </Button>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </aside>
  );
}
