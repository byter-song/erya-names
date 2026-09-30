import type { LocalDataHealth } from "../../application/use-cases/CheckLocalDataHealth";
import { Button } from "../../design-system/primitives/Button";
import { Card } from "../../design-system/primitives/Card";

export function ReadOnlyRecoveryPage({
  health,
  onExportRawBackup,
  onExportDiagnostic,
}: {
  health: LocalDataHealth;
  onExportRawBackup: () => void;
  onExportDiagnostic: () => void;
}) {
  return (
    <main className="backup-page">
      <header>
        <p className="project-center__kicker">READ-ONLY RECOVERY</p>
        <h1>本地数据需要恢复</h1>
        <p>为保护现有数据，应用已进入只读模式，不会自动清空或继续写入。</p>
      </header>
      <Card className="backup-page__card">
        <h2>检测结果</h2>
        <ul>
          {health.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
        <p>数据库版本：{health.databaseVersion}</p>
        <Button onClick={onExportRawBackup} type="button">
          导出原始本地数据
        </Button>
        <Button onClick={onExportDiagnostic} type="button">
          导出脱敏诊断
        </Button>
      </Card>
    </main>
  );
}
