import { ExportSelectedNames } from "../../../application/use-cases/ExportSelectedNames";
import { SelectedExportPage } from "../../../features/export/SelectedExportPage";
import { downloadSelectedNamesJson } from "../../../infrastructure/export/downloadJson";
import {
  preparePrintDocument,
  printDocument,
} from "../../../infrastructure/export/printDocument";
import { useApplicationContainer } from "../../providers";
import { selectedExportRoute } from "./$projectId.export";

export function SelectedExportRoute() {
  const { projectId } = selectedExportRoute.useParams();
  const container = useApplicationContainer();
  const { getProjectWorkspace, getCandidateFunnel, getCandidateDetail } = container;

  if (!getProjectWorkspace || !getCandidateFunnel || !getCandidateDetail)
    return (
      <main className="selected-export-page">
        <h1>精选导出暂不可用</h1>
        <p role="alert">本地导出服务尚未完成初始化，请返回方案中心后重试。</p>
      </main>
    );

  const exporter = new ExportSelectedNames(
    getProjectWorkspace,
    getCandidateFunnel,
    getCandidateDetail,
  );
  return (
    <SelectedExportPage
      exporter={exporter}
      onDownloadJson={(document) =>
        downloadSelectedNamesJson(
          `erya-selected-${document.project.surname}-${document.candidates.length}.json`,
          document,
        )
      }
      onPrint={(document) => {
        preparePrintDocument(document);
        printDocument();
      }}
      projectId={projectId}
    />
  );
}
