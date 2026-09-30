import { useState } from "react";
import { Button } from "../../design-system/primitives/Button";
import { Card } from "../../design-system/primitives/Card";
import "./backup.css";

export function BackupPage({
  projectTitle,
  onExport,
}: {
  projectTitle: string;
  onExport: (password?: string) => Promise<void>;
}) {
  const [encrypted, setEncrypted] = useState(false);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");

  async function exportBackup() {
    if (encrypted && password.length < 8) {
      setStatus("备份密码至少需要 8 个字符。");
      return;
    }
    await onExport(encrypted ? password : undefined);
    setStatus(encrypted ? "加密备份已下载。" : "JSON 备份已下载。");
  }

  return (
    <main className="backup-page">
      <header>
        <p className="project-center__kicker">BACKUP &amp; RECOVERY</p>
        <h1>备份与导出</h1>
        <p>{projectTitle} 的完整数据仅从当前浏览器导出，不会上传服务器。</p>
      </header>
      <Card className="backup-page__card">
        <h2>项目备份</h2>
        <p>包含起名条件、批次、候选、规则证据、筛选记录、评价和最终决定。</p>
        <label className="backup-page__choice">
          <input
            aria-label="使用密码加密"
            checked={encrypted}
            onChange={(event) => setEncrypted(event.target.checked)}
            type="checkbox"
          />
          使用密码加密
        </label>
        {encrypted ? (
          <label className="ui-field">
            <span>备份密码</span>
            <input
              aria-label="备份密码"
              autoComplete="new-password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>
        ) : null}
        <Button onClick={() => void exportBackup()} type="button">
          {encrypted ? "下载加密备份" : "下载 JSON 备份"}
        </Button>
        {status ? <p role="status">{status}</p> : null}
      </Card>
      <a href="/recovery">从备份恢复数据</a>
    </main>
  );
}
