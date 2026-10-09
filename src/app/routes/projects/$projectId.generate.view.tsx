import { generationRoute } from "./$projectId.generate";
import { useNavigate } from "@tanstack/react-router";
import { useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { activeRuntimeBundle } from "../../../data/activeRuntimeBundle";
import { GenerationCenterPage } from "../../../features/generation/GenerationCenterPage";
import { ProfileEditor } from "../../../features/generation/ProfileEditor";
import {
  CandidateFunnelPage,
  type FunnelCandidate,
} from "../../../features/funnel/CandidateFunnelPage";
import { FolkloreReviewSettings } from "../../../features/funnel/FolkloreReviewSettings";
import { familyRulesArePending, type NamingProfile } from "../../../domain/project/profile";
import type { CandidateStage } from "../../../domain/candidate/decision";
import { useApplicationContainer } from "../../providers";
export function GenerationRoute() {
  const { projectId } = generationRoute.useParams();
  const container = useApplicationContainer();
  const navigate = useNavigate();
  const locationHash = useRouterState({ select: (state) => state.location.hash });
  const requestedStage = locationHash.replace(/^#/, "");
  const initialStage = ["basic", "folklore"].includes(requestedStage)
    ? (requestedStage as "basic" | "folklore")
    : "inbox";
  const [profile, setProfile] = useState<NamingProfile>();
  const [candidates, setCandidates] = useState<FunnelCandidate[]>([]);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    const [workspace, items] = await Promise.all([
      container.getProjectWorkspace?.execute(projectId),
      container.getCandidateFunnel?.execute(projectId),
    ]);
    if (!workspace?.ok) throw new Error("未找到起名方案，请返回方案中心创建或恢复。");
    setProfile(workspace.value.profile);
    setCandidates(items ?? []);
    window.dispatchEvent(new Event("erya:journey-changed"));
  }, [container, projectId]);
  useEffect(() => {
    void reload().catch((reason) =>
      setError(reason instanceof Error ? reason.message : "读取失败"),
    );
  }, [reload]);
  const move = async (candidateId: string, to: CandidateStage, rejectionReason?: string) => {
    if (to === "comparison" && profile && familyRulesArePending(profile)) {
      throw new Error("请先核对是否有必须遵守的字辈或避讳");
    }
    const result = await container.moveCandidateDecision?.execute({
      projectId,
      candidateId,
      to,
      ...(rejectionReason ? { rejectionReason } : {}),
    });
    if (!result?.ok) throw new Error(result?.error ?? "决策服务暂不可用");
    await reload();
  };
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
    <GenerationCenterPage
      profile={profile}
      datasetVersion={activeRuntimeBundle.manifest.version}
      generate={async (input) => {
        const generated = await container.generateCandidateBatch?.execute({
          projectId,
          ...input,
          seed: `${projectId}:${crypto.randomUUID()}`,
        });
        if (!generated?.ok) throw new Error(generated?.error ?? "生成服务暂不可用");
        await reload();
        return {
          candidateCount: generated.value.candidateIds.length,
          batchId: generated.value.batchId,
        };
      }}
      conditions={
        <ProfileEditor
          key={projectId}
          profile={profile}
          onSave={async (next) => {
            const updated = await container.updateNamingProfile?.execute({
              projectId,
              patch: next,
              completeOnboarding: false,
            });
            if (!updated?.ok) throw new Error(updated?.error ?? "保存失败");
            setProfile(updated.value.profile);
          }}
        />
      }
    >
      {({ generationControls, onGenerateMore, generationBusy, latestBatchId }) => (
        <CandidateFunnelPage
          embedded
          profile={profile}
          candidates={candidates}
          sessionKey={projectId}
          initialStage={initialStage}
          generationControls={generationControls}
          folkloreControls={
            <FolkloreReviewSettings
              candidateCount={
                candidates.filter((candidate) => candidate.stage === "folklore_review").length
              }
              profile={profile}
              onSave={async (folklore) => {
                const updated = await container.updateFolkloreReviewSettings?.execute({
                  projectId,
                  folklore,
                });
                if (!updated?.ok) throw new Error(updated?.error ?? "民俗候选重评服务未就绪");
                setProfile(updated.value.profile);
                await reload();
              }}
            />
          }
          onGenerateMore={onGenerateMore}
          generationBusy={generationBusy}
          latestGeneratedBatchId={latestBatchId}
          progressionBlocked={familyRulesArePending(profile)}
          onResolveConstraints={() => {
            location.hash = "conditions";
          }}
          onStageChange={(stage) => {
            if (stage === "excluded") return;
            void navigate({
              to: "/projects/$projectId/generate",
              params: { projectId },
              hash: stage,
            });
          }}
          onApplyAutoFilter={async ({ moves }) => {
            const applied = await container.applyCandidateAutoFilter?.execute({
              projectId,
              moves,
            });
            if (!applied?.ok) throw new Error(applied?.error ?? "自动筛选服务未就绪");
            await reload();
          }}
          initialCanUndo={Boolean(container.undoCandidateDecision?.hasCommands(projectId))}
          onFavorite={(id) => move(id, "basic_shortlist")}
          onMove={(id, stage, reason) => move(id, stage, reason)}
          onEvaluate={async (candidateId, rating, note) => {
            const result = await container.recordCandidateEvaluation?.execute({
              projectId,
              candidateId,
              rating,
              note,
            });
            if (!result?.ok) throw new Error(result?.error ?? "保存评价失败");
            await reload();
          }}
          onUndo={async () => {
            const result = await container.undoCandidateDecision?.execute({ projectId });
            if (!result?.ok) throw new Error(result?.error ?? "撤销失败");
            await reload();
            return result.value.hasMore;
          }}
          onOpenComparison={() =>
            void navigate({ to: "/projects/$projectId/compare", params: { projectId } })
          }
          onAddManual={async (input) => {
            const result = await container.addManualCandidate?.execute({ projectId, ...input });
            if (!result?.ok) throw new Error(result?.error ?? "录入失败");
            await move(result.value.candidateId, "basic_shortlist");
          }}
        />
      )}
    </GenerationCenterPage>
  );
}
