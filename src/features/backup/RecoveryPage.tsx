import { useState } from "react";
import type {
  BackupConflictStrategy,
  BackupImportAction,
} from "../../application/ports/BackupRepository";
import type { BackupImportPreview } from "../../application/use-cases/PreviewBackupImport";
import { Button } from "../../design-system/primitives/Button";
import "./backup.css";

export function RecoveryPage({
  onPreview,
  onRestore,
}: {
  onPreview: (file: File, password?: string) => Promise<BackupImportPreview>;
  onRestore: (
    file: File,
    strategy: BackupConflictStrategy,
    password?: string,
  ) => Promise<{ projectId: string; action: BackupImportAction }>;
}) {
  const [file, setFile] = useState<File>();
  const [password, setPassword] = useState("");
  const [preview, setPreview] = useState<BackupImportPreview>();
  const [strategy, setStrategy] = useState<BackupConflictStrategy>();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [activity, setActivity] = useState<"preview" | "restore">();

  async function previewFile(selected: File) {
    setFile(selected);
    setPreview(undefined);
    setStrategy(undefined);
    setStatus("");
    setError("");
    setActivity("preview");
    try {
      const result = await onPreview(selected, password || undefined);
      setPreview(result);
      setStrategy(result.conflict === "project-id" ? "import-copy" : "replace");
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
      setStatus(
        result.action === "kept"
          ? "已保留当前方案，未写入备份。"
          : `恢复完成：${result.projectId}`,
      );
    } catch (reason) {
      setError(toRecoveryMessage(reason, "restore"));
    } finally {
      setActivity(undefined);
    }
  }

  return (
    <main className="backup-page backup-page--vault">
      <header className="safety-vault-hero">
        <div>
          <p className="project-center__kicker">尔雅 · 恢复长卷</p>
          <h1>恢复数据</h1>
          <p>
            仅接受当前尔雅 v2 导出的 backup
            v1。文件会在本机完成校验和解密，预览确认前不会修改本地数据。
          </p>
        </div>
        <div className="safety-vault-hero__status" aria-label="恢复状态">
          <span>恢复步骤</span>
          <strong>先预览</strong>
        </div>
      </header>

      <section className="safety-vault-panel" aria-labelledby="recovery-title">
        <div className="safety-vault-panel__heading">
          <div>
            <p className="project-center__kicker">IMPORT</p>
            <h2 id="recovery-title">预览并恢复备份</h2>
            <p>恢复前请确认文件来源可信；旧版备份不会转换或写入当前数据库。</p>
          </div>
          <a href="/">返回方案中心</a>
        </div>

        <div className="safety-vault-form">
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
        </div>
        {activity === "preview" ? <p role="status">正在校验备份文件…</p> : null}
        {file && !preview && activity !== "preview" ? (
          <Button onClick={() => void previewFile(file)} type="button">
            重新预览备份
          </Button>
        ) : null}
        {preview ? (
          <section aria-label="恢复预览">
            <h2>{preview.projectTitle}</h2>
            <p>
              {preview.conflict === "project-id"
                ? "检测到同 ID 方案，将使用新的方案 ID 恢复为副本"
                : "可作为新方案导入"}
            </p>
            <p>候选 {preview.counts.candidates ?? 0} 条</p>
            <p>
              精选 {preview.poolCounts.selected} 条 · 排除 {preview.poolCounts.excluded} 条 ·
              评分 {preview.counts.candidateScores ?? 0} 条 · 证据{" "}
              {preview.counts.ruleEvidence ?? 0}条
            </p>
            {preview.conflict === "project-id" ? (
              <label className="ui-field">
                <span>冲突处理方式</span>
                <select
                  aria-label="冲突处理方式"
                  onChange={(event) =>
                    setStrategy(event.target.value as BackupConflictStrategy)
                  }
                  value={strategy}
                >
                  <option value="import-copy">使用新 ID 另存为副本</option>
                  <option value="keep-current">保留当前数据，不导入</option>
                </select>
              </label>
            ) : null}
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
      </section>
      <details className="safety-vault-help">
        <summary>备份与恢复说明</summary>
        <section className="safety-vault-grid" aria-label="恢复规则">
          <article>
            <span>01</span>
            <strong>读取文件</strong>
            <p>支持当前 v2 backup v1 的普通 JSON 与加密备份；加密文件需要正确密码。</p>
          </article>
          <article>
            <span>02</span>
            <strong>预览影响</strong>
            <p>先展示方案名称、候选、四池状态、评分证据和冲突状态。</p>
          </article>
          <article>
            <span>03</span>
            <strong>确认写入</strong>
            <p>只有选择冲突处理方式并确认恢复后，才会写入本地数据库。</p>
          </article>
        </section>
      </details>
    </main>
  );
}

function toRecoveryMessage(reason: unknown, phase: "preview" | "restore"): string {
  const message = reason instanceof Error ? reason.message : "";
  if (message === "unsupported-format")
    return "不支持的备份格式（unsupported-format）。仅可恢复当前尔雅 v2 导出的 backup v1，旧版备份不会迁移。";
  if (message === "invalid-checksum") return "备份完整性校验失败，文件可能已损坏。";
  if (message === "invalid-payload") return "备份内容不完整或不属于当前 v2 数据模型。";
  if (/password|required|decrypt|operationerror/i.test(message))
    return "无法解密备份，请确认密码正确后重试。";
  if (/checksum|校验/i.test(message)) return "备份完整性校验失败，文件可能已损坏。";
  if (/json|invalid|unrecognized|format|parse|格式/i.test(message))
    return "备份文件格式无效，请确认选择了完整的尔雅 JSON 备份。";
  return phase === "preview" ? "无法读取备份文件，请重试。" : "恢复失败，请重试。";
}
