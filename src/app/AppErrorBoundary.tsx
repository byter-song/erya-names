import { Button } from "../design-system/primitives/Button";

export interface AppErrorBoundaryProps {
  error: Error;
  onRetry: () => void;
}

function diagnosticPayload(error: Error): string {
  return JSON.stringify(
    {
      code: error.name || "ApplicationError",
      appVersion: __APP_VERSION__,
      occurredAt: new Date().toISOString(),
    },
    null,
    2,
  );
}

export function AppErrorBoundary({ error, onRetry }: AppErrorBoundaryProps) {
  const downloadDiagnostic = () => {
    const blob = new Blob([diagnosticPayload(error)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "erya-names-diagnostic.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="error-page">
      <p className="project-center__kicker">ERYA NAMES · RECOVERY</p>
      <h1>应用暂时无法继续</h1>
      <p>
        你的本地方案不会被自动清除。可以重试、返回方案中心，或导出不含姓名和家庭信息的诊断文件。
      </p>
      <div className="error-page__actions">
        <Button onClick={onRetry} type="button">
          重试
        </Button>
        <a href="/">返回方案中心</a>
        <button onClick={downloadDiagnostic} type="button">
          导出脱敏诊断
        </button>
      </div>
    </main>
  );
}
