import { generationRoute } from "./$projectId.generate";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { activeRuntimeBundle } from "../../../data/activeRuntimeBundle";
import { ProfileEditor } from "../../../features/generation/ProfileEditor";
import { InkLongScrollPage } from "../../../features/scroll/InkLongScrollPage";
import type { FunnelCandidate } from "../../../features/funnel/CandidateFunnelPage";
import { FolkloreReviewSettings } from "../../../features/funnel/FolkloreReviewSettings";
import { familyRulesArePending, type NamingProfile } from "../../../domain/project/profile";
import type { CandidateStage } from "../../../domain/candidate/decision";
import { useApplicationContainer } from "../../providers";

const GENERATION_BATCH_SIZE = 9;

export function GenerationRoute() {
  const { projectId } = generationRoute.useParams();
  const container = useApplicationContainer();
  const navigate = useNavigate();
  const locationHash = useRouterState({ select: (state) => state.location.hash });
  const [profile, setProfile] = useState<NamingProfile>();
  const [candidates, setCandidates] = useState<FunnelCandidate[]>([]);
  const [generationBusy, setGenerationBusy] = useState(false);
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
    } finally {
      setGenerationBusy(false);
    }
  }, [container, generationBusy, projectId, reload]);

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
      datasetVersion={activeRuntimeBundle.manifest.version}
      generationBusy={generationBusy}
      initialPanel={locationHash === "#conditions" ? "conditions" : null}
      onGenerate={generate}
      onFavorite={(candidateId) => move(candidateId, "basic_shortlist")}
      onOpenComparison={() =>
        void navigate({ to: "/projects/$projectId/compare", params: { projectId } })
      }
      onOpenFinalization={() =>
        void navigate({ to: "/projects/$projectId/finalize", params: { projectId } })
      }
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
      folkloreSettings={
        <FolkloreReviewSettings
          candidateCount={candidates.filter((candidate) => candidate.stage === "folklore_review").length}
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
    />
  );
}
