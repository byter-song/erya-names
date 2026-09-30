import { useEffect, useState } from "react";
import { Button } from "../../design-system/primitives/Button";
import { Card } from "../../design-system/primitives/Card";
import "../comparison/comparison.css";

export interface FinalistView {
  id: string;
  fullName: string;
  summary: string;
  rating?: number;
}

export function FinalizationPage({
  candidates,
  onFinalize,
  initialDecision,
}: {
  candidates: FinalistView[];
  onFinalize: (input: { selectedCandidateId: string; rationale: string }) => Promise<void>;
  initialDecision?: { selectedCandidateId: string; rationale: string };
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedCandidateId, setSelectedCandidateId] = useState(
    initialDecision?.selectedCandidateId ?? "",
  );
  const [rationale, setRationale] = useState(initialDecision?.rationale ?? "");
  const [saved, setSaved] = useState(Boolean(initialDecision));

  useEffect(() => {
    if (!initialDecision) return;
    setSelectedCandidateId(initialDecision.selectedCandidateId);
    setRationale(initialDecision.rationale);
    setSaved(true);
  }, [initialDecision]);

  const submit = async () => {
    if (!selectedCandidateId || !rationale.trim()) return;
    setBusy(true);
    setError("");
    try {
      await onFinalize({ selectedCandidateId, rationale: rationale.trim() });
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存失败，请重试");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="finalization-page no-print">
      <header>
        <p className="project-center__kicker">FINAL DECISION</p>
        <h1>最终定稿</h1>
        <p>在 3–5 个最终候选中记录最终选择与真实取舍。</p>
      </header>
      <section className="finalization-page__grid">
        {candidates.map((candidate) => (
          <Card className="finalization-card" key={candidate.id}>
            <label>
              <input
                aria-label={`选择${candidate.fullName}`}
                checked={selectedCandidateId === candidate.id}
                name="final-name"
                onChange={() => {
                  setSelectedCandidateId(candidate.id);
                  setSaved(false);
                }}
                type="radio"
              />
              <h2>{candidate.fullName}</h2>
            </label>
            <p>{candidate.summary}</p>
            <p>{candidate.rating ? `${candidate.rating} 分` : "未评分"}</p>
          </Card>
        ))}
      </section>
      <label className="ui-field" style={{ marginTop: 18 }}>
        <span>最终选择说明</span>
        <textarea
          aria-label="最终选择说明"
          onChange={(event) => {
            setRationale(event.target.value);
            setSaved(false);
          }}
          rows={4}
          value={rationale}
        />
      </label>
      <div style={{ marginTop: 14 }}>
        <Button
          disabled={busy || !selectedCandidateId || !rationale.trim()}
          onClick={() => void submit()}
          type="button"
        >
          保存最终选择
        </Button>
      </div>
      {error ? <p role="alert">{error}</p> : null}
      {saved ? (
        <section className="finalization-page__complete" role="status">
          <span aria-hidden="true">定</span>
          <div>
            <strong>
              最终选择已保存：
              {candidates.find((candidate) => candidate.id === selectedCandidateId)?.fullName ??
                ""}
            </strong>
            <p>
              定稿已保存在当前设备。下方可以预览完整解释，并按需隐藏出生、民俗或备注后打印 PDF。
            </p>
          </div>
        </section>
      ) : null}
    </main>
  );
}
