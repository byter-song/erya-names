import { finalizationRoute } from "./$projectId.finalize";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useApplicationContainer } from "../../providers";
import {
  FinalizationPage,
  type FinalistView,
} from "../../../features/finalization/FinalizationPage";
import type { FinalDecision } from "../../../domain/candidate/finalDecision";
import { FinalReport, type ReportRedactions } from "../../../features/finalization/FinalReport";
import type { FinalReportModel } from "../../../application/models/FinalReportModel";
import { Button } from "../../../design-system/primitives/Button";
import { printDocument } from "../../../infrastructure/export/printDocument";
import "../../../design-system/print.css";

export function FinalizationRoute() {
  const { projectId } = finalizationRoute.useParams();
  const container = useApplicationContainer();
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<FinalistView[]>([]);
  const [decision, setDecision] = useState<FinalDecision>();
  const [report, setReport] = useState<FinalReportModel>();
  const [redactions, setRedactions] = useState<ReportRedactions>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const reload = useCallback(async () => {
    setLoadError("");
    try {
      const [items, savedDecision] = await Promise.all([
        container.getCandidateFunnel?.execute(projectId),
        container.getFinalDecision?.execute(projectId),
      ]);
      setCandidates(
        (items ?? [])
          .filter((item) => item.stage === "finalist")
          .map((item) => ({
            id: item.id,
            fullName: item.fullName,
            summary: item.summary,
            ...(item.rating !== undefined ? { rating: item.rating } : {}),
          })),
      );
      setDecision(savedDecision);
    } catch (reason) {
      setLoadError(reason instanceof Error ? reason.message : "最终候选读取失败，请重试");
    } finally {
      setLoading(false);
    }
  }, [container, projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (loading)
    return (
      <main className="finalization-page">
        <p role="status">正在读取最终候选…</p>
      </main>
    );

  if (loadError)
    return (
      <main className="finalization-page">
        <h1>最终定稿暂时无法打开</h1>
        <p role="alert">{loadError}</p>
        <Button onClick={() => void reload()} type="button">
          重新读取
        </Button>
      </main>
    );

  if (candidates.length < 3 || candidates.length > 5)
    return (
      <main className="finalization-page">
        <header>
          <p className="project-center__kicker">FINAL DECISION</p>
          <h1>最终定稿</h1>
          <p>需要先保存 3–5 个最终候选。当前已保存 {candidates.length} 个。</p>
        </header>
        <section className="comparison-page__empty paper-card">
          <h2>最终候选尚未准备好</h2>
          <p>返回候选对比继续选择。已经选过的名字不会丢失，也可以移回对比重新调整。</p>
          <Button
            onClick={() =>
              void navigate({ to: "/projects/$projectId/compare", params: { projectId } })
            }
            type="button"
          >
            返回候选对比
          </Button>
        </section>
      </main>
    );

  return (
    <>
      <FinalizationPage
        candidates={candidates}
        {...(decision ? { initialDecision: decision } : {})}
        onFinalize={async ({ selectedCandidateId, rationale }) => {
          const finalized = await container.finalizeNamingDecision?.execute({
            projectId,
            selectedCandidateId,
            rationale,
          });
          if (!finalized?.ok) throw new Error(finalized?.error ?? "最终定稿服务未就绪");
          setDecision(finalized.value);
          const built = await container.buildFinalReport?.execute(projectId);
          if (!built?.ok) throw new Error(built?.error ?? "定稿已保存，但报告生成失败");
          setReport(built.value);
        }}
      />
      {decision || report ? (
        <section className="finalization-page no-print" aria-label="报告导出设置">
          <h2>生成定稿报告</h2>
          {(
            [
              ["birthData", "隐藏出生信息"],
              ["avoidCharacters", "隐藏避字信息"],
              ["notes", "隐藏个人备注"],
              ["folklore", "隐藏民俗参考"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={Boolean(redactions[key])}
                onChange={(event) =>
                  setRedactions((current) => ({ ...current, [key]: event.target.checked }))
                }
              />
              {label}
            </label>
          ))}
          <Button
            onClick={async () => {
              const built = await container.buildFinalReport?.execute(projectId);
              if (!built?.ok) throw new Error(built?.error ?? "报告尚未就绪");
              setReport(built.value);
            }}
            type="button"
          >
            预览定稿报告
          </Button>
          {report ? (
            <Button onClick={printDocument} type="button">
              打印或保存 PDF
            </Button>
          ) : null}
        </section>
      ) : null}
      {report ? <FinalReport report={report} redactions={redactions} /> : null}
    </>
  );
}
