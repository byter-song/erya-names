import { namesRoute } from "./$projectId.names";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  InkLongScrollPage,
  type ScrollChapter,
} from "../../../features/scroll/InkLongScrollPage";
import type { CandidateFunnelItem } from "../../../application/models/CandidateFunnelItem";
import { ExcludedCandidatesSection } from "../../../features/funnel/ExcludedCandidatesSection";
import { ComparisonPage } from "../../../features/comparison/ComparisonPage";
import { familyRulesArePending, type NamingProfile } from "../../../domain/project/profile";
import type { CandidateMoveDirection } from "../../../domain/candidate/decisionState";
import { useApplicationContainer } from "../../providers";

const GENERATION_BATCH_SIZE = 9;

export function NamesRoute() {
  const { projectId } = namesRoute.useParams();
  const routeBase = `/projects/${encodeURIComponent(projectId)}/names`;
  const container = useApplicationContainer();
  const navigate = useNavigate();
  const locationHash = useRouterState({ select: (state) => state.location.hash });
  const [profile, setProfile] = useState<NamingProfile>();
  const [candidates, setCandidates] = useState<CandidateFunnelItem[]>([]);
  const [generationBusy, setGenerationBusy] = useState(false);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [analysisFailure, setAnalysisFailure] = useState("");
  const [canUndo, setCanUndo] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    const [workspace, items, assessmentRun] = await Promise.all([
      container.getProjectWorkspace?.execute(projectId),
      container.getCandidateFunnel?.execute(projectId),
      container.getAssessmentRun?.execute(projectId),
    ]);
    if (!workspace?.ok) throw new Error("未找到起名方案，请返回方案中心创建或恢复。");
    setProfile(workspace.value.profile);
    setCandidates(items ?? []);
    setAnalysisFailure(
      assessmentRun?.status === "failed"
        ? "上次综合分析未完成。已生成的名字仍安全保存在本机，可重新分析。"
        : "",
    );
    window.dispatchEvent(new Event("erya:journey-changed"));
  }, [container, projectId]);

  useEffect(() => {
    void reload().catch((reason) =>
      setError(reason instanceof Error ? reason.message : "读取失败"),
    );
  }, [reload]);

  const move = async (
    candidateId: string,
    direction: CandidateMoveDirection,
    expectedUpdatedAt: string,
  ) => {
    const candidate = candidates.find((item) => item.id === candidateId);
    if (
      direction === "forward" &&
      candidate?.pool === "candidate" &&
      profile &&
      familyRulesArePending(profile.family)
    ) {
      throw new Error("请先核对是否有必须遵守的字辈或避讳");
    }
    const result = await container.moveCandidateDecision?.execute({
      projectId,
      candidateId,
      direction,
      expectedUpdatedAt,
    });
    if (!result?.ok) throw new Error(result?.error ?? "决策服务暂不可用");
    setCanUndo(true);
    await reload();
  };

  const generate = useCallback(async () => {
    if (generationBusy) return;
    setGenerationBusy(true);
    try {
      const generated = await container.generateCandidateBatch?.execute({
        projectId,
        requestedCount: GENERATION_BATCH_SIZE,
        allusionRatio: 0.5,
        seed: `${projectId}:${crypto.randomUUID()}`,
      });
      if (!generated?.ok) throw new Error(generated?.error ?? "生成服务暂不可用");
      await reload();
      if (generated.value.analysis.status === "failed")
        setAnalysisFailure(
          "名字已生成并保存，但综合分析未完成。请重新分析当前配置下的全部名字。",
        );
      if (!generated.value.candidateIds.length)
        throw new Error(
          "本轮没有新的合规候选。可调整灵感来源或起名条件；已有名字不会重复加入。",
        );
    } finally {
      setGenerationBusy(false);
    }
  }, [container, generationBusy, projectId, reload]);

  const loadCandidateDetail = useCallback(
    (candidateId: string) =>
      container.getCandidateDetail?.execute(projectId, candidateId) ??
      Promise.resolve(undefined),
    [container, projectId],
  );

  if (error)
    return (
      <main className="generation-center">
        <h1>暂时无法打开方案</h1>
        <p role="alert">{error}</p>
        <a href="/">返回方案中心</a>
      </main>
    );
  if (!profile)
    return (
      <main className="generation-center">
        <p role="status">正在读取方案…</p>
      </main>
    );

  return (
    <InkLongScrollPage
      profile={profile}
      candidates={candidates}
      generationBusy={generationBusy}
      {...(analysisFailure
        ? {
            analysisRecovery: {
              message: analysisFailure,
              busy: analysisBusy,
              onRetry: async () => {
                if (analysisBusy || !container.analyzeCurrentProjectCandidates) return;
                setAnalysisBusy(true);
                try {
                  const outcome = await container.analyzeCurrentProjectCandidates.execute({
                    projectId,
                  });
                  await reload();
                  if (outcome.status === "failed")
                    setAnalysisFailure("综合分析仍未完成，请稍后再次重试。");
                } finally {
                  setAnalysisBusy(false);
                }
              },
            },
          }
        : {})}
      chapter={
        (["candidate", "selected", "excluded"].includes(locationHash.replace(/^#/, ""))
          ? locationHash.replace(/^#/, "")
          : "inspiration") as ScrollChapter
      }
      onChapterChange={(chapter) =>
        void navigate({
          href: `${routeBase}#${chapter}`,
        })
      }
      onGenerate={generate}
      onMove={move}
      onExclude={async (candidateId, reason, expectedUpdatedAt) => {
        const result = await container.excludeCandidate?.execute({
          projectId,
          candidateId,
          reason,
          expectedUpdatedAt,
        });
        if (!result?.ok) throw new Error(result?.error ?? "排除失败");
        await reload();
      }}
      onRestore={async (candidateId, expectedUpdatedAt) => {
        const result = await container.restoreExcludedCandidate?.execute({
          projectId,
          candidateId,
          expectedUpdatedAt,
        });
        if (!result?.ok) throw new Error(result?.error ?? "恢复失败");
        await reload();
      }}
      onEvaluate={async (candidateId, rating, note) => {
        const result = await container.recordCandidateEvaluation?.execute({
          projectId,
          candidateId,
          ...(rating !== undefined ? { rating } : {}),
          note,
        });
        if (!result?.ok) throw new Error(result?.error ?? "评价保存失败");
        await reload();
      }}
      onUndo={async () => {
        const result = await container.undoCandidateDecision?.execute({ projectId });
        if (!result?.ok) {
          if (result?.error === "no-undo-command") return false;
          throw new Error(result?.error ?? "撤销失败");
        }
        await reload();
        setCanUndo(result.value.hasMore);
        return true;
      }}
      onAddManual={async (input) => {
        const result = await container.addManualCandidate?.execute({ projectId, ...input });
        if (!result?.ok) throw new Error(result?.error ?? "手工添加失败");
        await reload();
        await navigate({
          href: `${routeBase}#inspiration`,
        });
      }}
      onOpenExport={() =>
        void navigate({ href: `/projects/${encodeURIComponent(projectId)}/export` })
      }
      onOpenConfiguration={() =>
        void navigate({ to: "/projects/$projectId/config", params: { projectId } })
      }
      onLoadCandidateDetail={loadCandidateDetail}
      comparisonContent={
        <ComparisonPage
          candidates={candidates.filter((candidate) => candidate.pool === "candidate")}
          profile={profile}
        />
      }
      excludedSection={
        <ExcludedCandidatesSection
          canUndo={canUndo}
          candidates={candidates}
          onRestore={async (candidateId, expectedUpdatedAt) => {
            const result = await container.restoreExcludedCandidate?.execute({
              projectId,
              candidateId,
              expectedUpdatedAt,
            });
            if (!result?.ok) throw new Error(result?.error ?? "恢复失败");
            await reload();
          }}
          onUndo={async () => {
            const result = await container.undoCandidateDecision?.execute({ projectId });
            if (!result?.ok) {
              if (result?.error === "no-undo-command") {
                setCanUndo(false);
                return false;
              }
              throw new Error(result?.error ?? "撤销失败");
            }
            setCanUndo(result.value.hasMore);
            await reload();
            return result.value.hasMore;
          }}
          onClear={async (selected, confirmedCount) => {
            const result = await container.clearExcludedCandidates?.execute({
              projectId,
              selected,
              confirmedCount,
            });
            if (!result?.ok) throw new Error(result?.error ?? "永久清空失败");
            await reload();
          }}
        />
      }
    />
  );
}
