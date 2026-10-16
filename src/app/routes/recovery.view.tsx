import { RecoveryPage } from "../../features/backup/RecoveryPage";
import { readBackupFile } from "../../infrastructure/backup/readBackupFile";
import { useApplicationContainer } from "../providers";

export function RecoveryRoute() {
  const container = useApplicationContainer();

  return (
    <RecoveryPage
      onPreview={async (file, password) => {
        const input = await readBackupFile(file, password);
        const result = await container.previewBackupImport?.execute(input);
        if (!result?.ok) throw new Error(result?.error ?? "恢复预览服务未就绪");
        return result.value;
      }}
      onRestore={async (file, strategy, password) => {
        const envelope = await readBackupFile(file, password);
        const result = await container.importProjectBackup?.execute({
          envelope,
          conflictStrategy: strategy,
        });
        if (!result?.ok) throw new Error(result?.error ?? "恢复服务未就绪");
        return result.value;
      }}
    />
  );
}
