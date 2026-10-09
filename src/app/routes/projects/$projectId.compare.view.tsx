import { comparisonRoute } from "./$projectId.compare";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useApplicationContainer } from "../../providers";
import { ComparisonPage } from "../../../features/comparison/ComparisonPage";
import { Button } from "../../../design-system/primitives/Button";
import type { CandidateFunnelItem as FunnelCandidate } from "../../../application/models/CandidateFunnelItem";
import type { ComparisonSnapshot } from "../../../domain/candidate/comparisonSnapshot";
import { familyRulesArePending } from "../../../domain/project/profile";

export function ComparisonRoute() {
  const { projectId } = comparisonRoute.useParams();
  const container = useApplicationContainer();
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<FunnelCandidate[]>([]);
  const [finalists, setFinalists] = useState<FunnelCandidate[]>([]);
  const [snapshots, setSnapshots] = useState<ComparisonSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [eligibilityBlocked, setEligibilityBlocked] = useState(false);

  const reload = useCallback(async () => {
    setLoadError("");
    try {
      const [items, workspace] = await Promise.all([
        container.getCandidateFunnel?.execute(projectId, ["comparison", "finalist"]),
        container.getProjectWorkspace?.execute(projectId),
      ]);
      const allItems = items ?? [];
      setEligibilityBlocked(
        Boolean(workspace?.ok && familyRulesArePending(workspace.value.profile)),
      );
      setCandidates(allItems.filter((item) => item.stage === "comparison"));
      setFinalists(allItems.filter((item) => item.stage === "finalist"));
      setSnapshots((await container.createComparisonSnapshot?.list(projectId)) ?? []);
      window.dispatchEvent(new Event("erya:journey-changed"));
    } catch (reason) {
      setLoadError(reason instanceof Error ? reason.message : "候选读取失败，请重试");
    } finally {
      setLoading(false);
    }
  }, [container, projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (loading)
    return (
      <main className="comparison-page">
        <p role="status">正在读取候选对比…</p>
      </main>
    );

  if (loadError)
    return (
      <main className="comparison-page">
        <h1>候选对比暂时无法打开</h1>
        <p role="alert">{loadError}</p>
        <Button onClick={() => void reload()} type="button">
          重新读取
        </Button>
      </main>
    );

  if (eligibilityBlocked)
    return (
      <main className="comparison-page">
        <h1>重点候选暂时锁定</h1>
        <p>家庭规则仍不确定。请先核对是否有必须遵守的字辈或避讳。</p>
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

  return (
    <ComparisonPage
      candidates={candidates}
      finalists={finalists}
      initialCanUndo={Boolean(container.undoCandidateDecision?.hasCommands(projectId))}
      snapshots={snapshots}
      onBackToCandidates={() =>
        void navigate({ to: "/projects/$projectId/generate", params: { projectId } })
      }
      onOpenFinalization={() =>
        void navigate({ to: "/projects/$projectId/finalize", params: { projectId } })
      }
      onSaveSnapshot={async (snapshotCandidates, name) => {
        const result = await container.createComparisonSnapshot?.execute({
          projectId,
          name,
          candidates: snapshotCandidates,
        });
        if (!result?.ok) throw new Error(result?.error ?? "对比快照服务未就绪");
        setSnapshots((await container.createComparisonSnapshot?.list(projectId)) ?? []);
      }}
      onUndo={async () => {
        const result = await container.undoCandidateDecision?.execute({ projectId });
        if (!result?.ok) throw new Error(result?.error ?? "撤销服务未就绪");
        await reload();
        return result.value.hasMore;
      }}
      onPromote={async (candidateId) => {
        const moved = await container.moveCandidateDecision?.execute({
          projectId,
          candidateId,
          to: "finalist",
        });
        if (!moved?.ok) throw new Error(moved?.error ?? "候选决策服务未就绪");
        await reload();
      }}
      onReturnToComparison={async (candidateId) => {
        const moved = await container.moveCandidateDecision?.execute({
          projectId,
          candidateId,
          to: "comparison",
        });
        if (!moved?.ok) throw new Error(moved?.error ?? "候选决策服务未就绪");
        await reload();
      }}
    />
  );
}
