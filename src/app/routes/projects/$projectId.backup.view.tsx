import { backupRoute } from "./$projectId.backup";
import { useEffect, useState } from "react";
import { BackupPage } from "../../../features/backup/BackupPage";
import { encryptBackup } from "../../../infrastructure/backup/encryption";
import { downloadJson } from "../../../infrastructure/export/downloadJson";
import { useApplicationContainer } from "../../providers";

export function BackupRoute() {
  const { projectId } = backupRoute.useParams();
  const container = useApplicationContainer();
  const [title, setTitle] = useState("当前起名方案");

  useEffect(() => {
    void container.getProjectWorkspace?.execute(projectId).then((workspace) => {
      if (workspace?.ok) setTitle(workspace.value.project.title);
    });
  }, [container, projectId]);

  return (
    <BackupPage
      projectTitle={title}
      onExport={async (password) => {
        const result = await container.exportProjectBackup?.execute(projectId);
        if (!result?.ok) throw new Error(result?.error ?? "备份服务未就绪");
        const value = password
          ? await encryptBackup(JSON.stringify(result.value), password)
          : result.value;
        downloadJson(`erya-names-${projectId}.json`, value);
      }}
    />
  );
}
