import { generationRoute } from "./$projectId.generate";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { activeRuntimeBundle } from "../../../data/activeRuntimeBundle";
import { GenerationCenterPage } from "../../../features/generation/GenerationCenterPage";
import { ProfileEditor } from "../../../features/generation/ProfileEditor";
import {
  CandidateFunnelPage,
  type FunnelCandidate,
} from "../../../features/funnel/CandidateFunnelPage";
import type { NamingProfile } from "../../../domain/project/profile";
import type { CandidateStage } from "../../../domain/candidate/decision";
import { useApplicationContainer } from "../../providers";
export function GenerationRoute() {
  const { projectId } = generationRoute.useParams();
  const container = useApplicationContainer();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<NamingProfile>();
  const [candidates, setCandidates] = useState<FunnelCandidate[]>([]);
  const [error, setError] = useState("");
  const [viewRevision, setViewRevision] = useState(0);
  const reload = useCallback(async () => {
    const [workspace, items] = await Promise.all([
      container.getProjectWorkspace?.execute(projectId),
      container.getCandidateFunnel?.execute(projectId),
    ]);
    if (!workspace?.ok) throw new Error("未找到起名方案，请返回方案中心创建或恢复。");
    setProfile(workspace.value.profile);
    setCandidates(items ?? []);
  }, [container, projectId]);
  useEffect(() => {
    void reload().catch((reason) =>
      setError(reason instanceof Error ? reason.message : "读取失败"),
    );
  }, [reload]);
  const move = async (candidateId: string, to: CandidateStage, rejectionReason?: string) => {
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
        try {
          sessionStorage.setItem(`erya-names:studio:${projectId}`, "inbox");
        } catch {
          /* View stays available without browser session storage. */
        }
        setViewRevision((n) => n + 1);
        return { candidateCount: generated.value.candidateIds.length };
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
      <CandidateFunnelPage
        key={`${projectId}:${viewRevision}`}
        embedded
        profile={profile}
        candidates={candidates}
        sessionKey={projectId}
        initialCanUndo={Boolean(container.undoCandidateDecision?.hasCommands(projectId))}
        onFavorite={(id) => move(id, "favorite")}
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
          await move(result.value.candidateId, "favorite");
        }}
      />
    </GenerationCenterPage>
  );
}
