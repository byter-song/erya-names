import { FinalReport } from "../../../features/finalization/FinalReport";
import type { FinalReportModel } from "../../../application/models/FinalReportModel";
import { printDocument } from "../../../infrastructure/export/printDocument";
import { finalizationRoute } from "./$projectId.finalize";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useApplicationContainer } from "../../providers";
import {
  FinalizationPage,
  type FinalistView,
} from "../../../features/finalization/FinalizationPage";
import { Button } from "../../../design-system/primitives/Button";
import { familyRulesArePending } from "../../../domain/project/profile";
import type { FinalDecision } from "../../../domain/candidate/finalDecision";

export function FinalizationRoute() {
  const { projectId } = finalizationRoute.useParams();
  const container = useApplicationContainer();
  const navigate = useNavigate();
  const [includePrivate, setIncludePrivate] = useState(false);
  const [report, setReport] = useState<FinalReportModel>();
  const [candidates, setCandidates] = useState<FinalistView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [eligibilityBlocked, setEligibilityBlocked] = useState(false);
  const [legacyDecision, setLegacyDecision] = useState<FinalDecision>();

  const reload = useCallback(async () => {
    setLoadError("");
    try {
      const [items, workspace, savedDecision] = await Promise.all([
        container.getCandidateFunnel?.execute(projectId, ["finalist"]),
        container.getProjectWorkspace?.execute(projectId),
        container.getFinalDecision?.execute(projectId),
      ]);
      setLegacyDecision(savedDecision);
      setEligibilityBlocked(
        Boolean(workspace?.ok && familyRulesArePending(workspace.value.profile)),
      );
      setCandidates(
        (items ?? [])
          .filter((item) => item.stage === "finalist")
          .map((item) => ({
            id: item.id,
            fullName: item.fullName,
            summary: item.summary,
            ...(item.note !== undefined ? { note: item.note } : {}),
            ...(item.eligibilityIssue ? { eligibilityIssue: item.eligibilityIssue } : {}),
            ...(item.rating !== undefined ? { rating: item.rating } : {}),
          })),
      );
      window.dispatchEvent(new Event("erya:journey-changed"));
    } catch (reason) {
      setLoadError(reason instanceof Error ? reason.message : "定稿名单读取失败，请重试");
    } finally {
      setLoading(false);
    }
  }, [container, projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const move = async (candidateId: string, to: "comparison" | "excluded", reason?: string) => {
    const moved = await container.moveCandidateDecision?.execute({
      projectId,
      candidateId,
      to,
      ...(reason ? { rejectionReason: reason } : {}),
    });
    if (!moved?.ok) throw new Error(moved?.error ?? "候选决策服务未就绪");
    await reload();
  };

  if (loading)
    return (
      <main className="finalization-page">
        <p role="status">正在读取定稿名单…</p>
      </main>
    );

  if (loadError)
    return (
      <main className="finalization-page">
        <h1>定稿名单暂时无法打开</h1>
        <p role="alert">{loadError}</p>
        <Button onClick={() => void reload()} type="button">
          重新读取
        </Button>
      </main>
    );

  if (eligibilityBlocked)
    return (
      <main className="finalization-page">
        <h1>定稿名单暂时锁定</h1>
        <p>家庭规则仍不确定。核对前不能进入定稿名单。</p>
        <Button
          onClick={() =>
            void navigate({
              to: "/projects/$projectId/generate",
              params: { projectId },
              hash: "conditions",
            })
          }
          type="button"
        >
          核对家庭规则
        </Button>
      </main>
    );

  if (candidates.length === 0)
    return (
      <main className="finalization-page">
        <header>
          <p className="project-center__kicker">FINAL LIST</p>
          <h1>定稿名单</h1>
          <p>当前名单为空。先从重点候选加入一个或多个名字。</p>
        </header>
        <section className="comparison-page__empty paper-card">
          <h2>还没有定稿名字</h2>
          <p>已有候选和评价都不会丢失，可以继续比较后再加入。</p>
          <Button
            onClick={() =>
              void navigate({ to: "/projects/$projectId/compare", params: { projectId } })
            }
            type="button"
          >
            返回重点候选
          </Button>
        </section>
      </main>
    );

  if (report)
    return (
      <main className="final-report-preview">
        <div className="no-print studio-actions">
          <button onClick={() => setReport(undefined)}>返回定稿名单</button>
          <button onClick={printDocument}>打印 / 保存 PDF</button>
          <p>此报告默认隐藏出生信息、避字和逐名私密备注；包含已确认的家庭选择理由。</p>
        </div>
        <label className="no-print inline-choice">
          <input
            type="checkbox"
            checked={includePrivate}
            onChange={(e) => setIncludePrivate(e.target.checked)}
          />
          报告包含出生信息、生肖提醒、避字和逐名备注（仅自用时勾选）
        </label>
        <FinalReport
          report={report}
          redactions={{
            birthData: !includePrivate,
            avoidCharacters: !includePrivate,
            notes: !includePrivate,
          }}
        />
      </main>
    );
  return (
    <FinalizationPage
      candidates={candidates}
      {...(legacyDecision
        ? {
            legacyDecision: {
              ...legacyDecision,
              ...(candidates.find(
                (candidate) => candidate.id === legacyDecision.selectedCandidateId,
              )?.fullName
                ? {
                    selectedCandidateName: candidates.find(
                      (candidate) => candidate.id === legacyDecision.selectedCandidateId,
                    )!.fullName,
                  }
                : {}),
            },
          }
        : {})}
      onExclude={(candidateId, reason) => move(candidateId, "excluded", reason)}
      onSavePreferred={async (selectedCandidateId, rationale) => {
        const result = await container.finalizeNamingDecision?.execute({
          projectId,
          selectedCandidateId,
          rationale,
        });
        if (!result?.ok) throw new Error(result?.error ?? "保存失败");
        await reload();
      }}
      onSaveNote={async (candidateId, note) => {
        const rating = candidates.find((c) => c.id === candidateId)?.rating;
        const result = await container.recordCandidateEvaluation?.execute({
          projectId,
          candidateId,
          note,
          ...(rating !== undefined ? { rating } : {}),
        });
        if (!result?.ok) throw new Error(result?.error ?? "保存失败");
        await reload();
      }}
      onReport={async () => {
        const result = await container.buildFinalReport?.execute(projectId);
        if (!result?.ok) throw new Error(result?.error ?? "报告生成失败");
        setReport(result.value);
      }}
      onExport={async () => {
        const result = await container.buildFinalReport?.execute(projectId);
        if (!result?.ok) throw new Error(result?.error ?? "当前条件尚不能导出");
        exportFinalList(candidates, legacyDecision);
      }}
      onRemove={(candidateId) => move(candidateId, "comparison")}
    />
  );
}

function exportFinalList(candidates: FinalistView[], decision?: FinalDecision): void {
  const content = [
    "尔雅起名 · 定稿名单",
    decision
      ? `首选：${candidates.find((c) => c.id === decision.selectedCandidateId)?.fullName ?? "待核对"}\n选择理由：${decision.rationale}`
      : "尚未指定唯一首选",
    "",
    ...candidates.map(
      (candidate, index) =>
        `${index + 1}. ${candidate.fullName}${candidate.rating ? ` · ${candidate.rating} 分` : ""}\n   ${candidate.summary}\n   保留理由：${candidate.note ?? "未填写"}`,
    ),
  ].join("\n");
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "erya-final-list.txt";
  link.click();
  URL.revokeObjectURL(url);
}
