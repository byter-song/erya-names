import { useState } from "react";
import type { BackupImportPreview } from "../../application/use-cases/PreviewBackupImport";
import { Button } from "../../design-system/primitives/Button";
import { Card } from "../../design-system/primitives/Card";
import "./backup.css";

type ConflictStrategy = "keep-current" | "replace" | "import-copy";

export function RecoveryPage({
  onPreview,
  onRestore,
}: {
  onPreview: (file: File, password?: string) => Promise<BackupImportPreview>;
  onRestore: (
    file: File,
    strategy: ConflictStrategy,
    password?: string,
  ) => Promise<{ projectId: string }>;
}) {
  const [file, setFile] = useState<File>();
  const [password, setPassword] = useState("");
  const [preview, setPreview] = useState<BackupImportPreview>();
  const [strategy, setStrategy] = useState<ConflictStrategy | "">("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [activity, setActivity] = useState<"preview" | "restore">();

  async function previewFile(selected: File) {
    setFile(selected);
    setPreview(undefined);
    setStrategy("");
    setStatus("");
    setError("");
    setActivity("preview");
    try {
      setPreview(await onPreview(selected, password || undefined));
    } catch (reason) {
      setError(toRecoveryMessage(reason, "preview"));
    } finally {
      setActivity(undefined);
    }
  }

  async function restore() {
    if (!file || !strategy) return;
    setError("");
    setStatus("");
    setActivity("restore");
    try {
      const result = await onRestore(file, strategy, password || undefined);
      setStatus(`恢复完成：${result.projectId}`);
    } catch (reason) {
      setError(toRecoveryMessage(reason, "restore"));
    } finally {
      setActivity(undefined);
    }
  }

  return (
    <main className="backup-page">
      <header>
        <p className="project-center__kicker">LOCAL RECOVERY</p>
        <h1>恢复数据</h1>
        <p>文件会在本机完成校验和解密；预览确认前不会写入数据库。</p>
      </header>
      <Card className="backup-page__card">
        <label className="ui-field">
          <span>备份密码（仅加密文件需要）</span>
          <input
            aria-label="备份密码"
            disabled={Boolean(activity)}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
        </label>
        <label className="ui-field">
          <span>选择备份文件</span>
          <input
            aria-label="选择备份文件"
            accept="application/json,.json"
            disabled={Boolean(activity)}
            onChange={(event) => {
              const selected = event.target.files?.[0];
              if (selected) void previewFile(selected);
            }}
            type="file"
          />
        </label>
        {activity === "preview" ? <p role="status">正在校验备份文件…</p> : null}
        {file && !preview && activity !== "preview" ? (
          <Button onClick={() => void previewFile(file)} type="button">
            重新预览备份
          </Button>
        ) : null}
        {preview ? (
          <section aria-label="恢复预览">
            <h2>{preview.projectTitle}</h2>
            <p>{preview.conflict === "project-id" ? "检测到同 ID 方案" : "可作为新方案导入"}</p>
            <p>候选 {preview.counts.candidates ?? 0} 条</p>
            <p>最终决定 {preview.counts.finalDecisions ?? 0} 条</p>
            <label className="ui-field">
              <span>冲突处理方式</span>
              <select
                aria-label="冲突处理方式"
                onChange={(event) => setStrategy(event.target.value as ConflictStrategy)}
                value={strategy}
              >
                <option value="">请选择</option>
                <option value="keep-current">保留当前数据</option>
                <option value="replace">覆盖当前方案</option>
                <option value="import-copy">另存为副本</option>
              </select>
            </label>
            <Button
              disabled={!strategy || Boolean(activity)}
              onClick={() => void restore()}
              type="button"
            >
              {activity === "restore" ? "正在恢复…" : "确认恢复"}
            </Button>
          </section>
        ) : null}
        {status ? <p role="status">{status}</p> : null}
        {error ? <p role="alert">{error}</p> : null}
      </Card>
    </main>
  );
}

function toRecoveryMessage(reason: unknown, phase: "preview" | "restore"): string {
  const message = reason instanceof Error ? reason.message : "";
  if (/password|required|decrypt|operationerror/i.test(message))
    return "无法解密备份，请确认密码正确后重试。";
  if (/schemaVersion|version|版本/i.test(message))
    return "备份版本不受支持，请使用当前版本导出的备份文件。";
  if (/checksum|校验/i.test(message)) return "备份完整性校验失败，文件可能已损坏。";
  if (/json|invalid|unrecognized|format|parse|格式/i.test(message))
    return "备份文件格式无效，请确认选择了完整的尔雅 JSON 备份。";
  return phase === "preview" ? "无法读取备份文件，请重试。" : "恢复失败，请重试。";
}
