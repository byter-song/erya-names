import { useState } from "react";
import { Button } from "../../design-system/primitives/Button";
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
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  async function exportBackup() {
    setStatus("");
    setError("");
    if (encrypted && password.length < 8) {
      setError("备份密码至少需要 8 个字符。");
      return;
    }
    if (encrypted && password !== passwordConfirmation) {
      setError("两次输入的备份密码不一致。");
      return;
    }
    setExporting(true);
    try {
      await onExport(encrypted ? password : undefined);
      setStatus(encrypted ? "加密备份已下载。" : "JSON 备份已下载。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "备份导出失败，请重试。");
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="backup-page backup-page--vault">
      <header className="safety-vault-hero">
        <div>
          <p className="project-center__kicker">SAFETY VAULT</p>
          <h1>安全穹顶</h1>
          <p>{projectTitle} 的完整数据只在当前浏览器中处理。导出文件由你自己保存，不会上传服务器。</p>
        </div>
        <div className="safety-vault-hero__status" aria-label="安全状态">
          <span>本地优先</span>
          <strong>无云端同步</strong>
        </div>
      </header>

      <section className="safety-vault-grid" aria-label="安全能力">
        <article>
          <span>01</span>
          <strong>完整备份</strong>
          <p>导出起名条件、批次、候选、规则证据、筛选记录、评价和最终决定。</p>
        </article>
        <article>
          <span>02</span>
          <strong>可选加密</strong>
          <p>加密文件使用你输入的密码，密码不会保存在浏览器或备份文件中。</p>
        </article>
        <article>
          <span>03</span>
          <strong>恢复前预览</strong>
          <p>导入备份会先校验并展示影响范围，确认前不会写入本地数据库。</p>
        </article>
      </section>

      <section className="safety-vault-panel" aria-labelledby="backup-title">
        <div className="safety-vault-panel__heading">
          <div>
            <p className="project-center__kicker">EXPORT</p>
            <h2 id="backup-title">创建项目备份</h2>
            <p>建议在大规模筛选、进入定稿或升级应用前导出一次备份。</p>
          </div>
          <a href="/recovery">恢复已有备份</a>
        </div>

        <div className="safety-vault-form">
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
            <>
              <label className="ui-field">
                <span>备份密码</span>
                <input
                  aria-label="备份密码"
                  autoComplete="new-password"
                  disabled={exporting}
                  onChange={(event) => setPassword(event.target.value)}
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
              </label>
              <label className="ui-field">
                <span>确认备份密码</span>
                <input
                  aria-label="确认备份密码"
                  autoComplete="new-password"
                  disabled={exporting}
                  onChange={(event) => setPasswordConfirmation(event.target.value)}
                  type={showPassword ? "text" : "password"}
                  value={passwordConfirmation}
                />
              </label>
            </>
          ) : null}
          {encrypted ? (
            <label className="backup-page__choice">
              <input
                checked={showPassword}
                disabled={exporting}
                onChange={(event) => setShowPassword(event.target.checked)}
                type="checkbox"
              />
              显示密码
            </label>
          ) : null}
        </div>

        <div className="safety-vault-actions">
          <Button disabled={exporting} onClick={() => void exportBackup()} type="button">
            {exporting ? "正在导出…" : encrypted ? "下载加密备份" : "下载 JSON 备份"}
          </Button>
        </div>
        {status ? <p role="status">{status}</p> : null}
        {error ? <p role="alert">{error}</p> : null}
      </section>
    </main>
  );
}
