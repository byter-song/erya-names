import { useEffect, useMemo, useRef, useState } from "react";
import type {
  SelectedNamesExport,
  SelectedNamesExportError,
  SelectedNamesExportFormat,
  SelectedNamesExportMode,
  SelectedNamesExportPreview,
} from "../../application/models/SelectedNamesExport";
import type { Result } from "../../domain/shared/result";
import { Button } from "../../design-system/primitives/Button";
import "./export.css";

interface ExportActions {
  preview(input: {
    projectId: string;
    candidateIds?: string[];
    mode: SelectedNamesExportMode;
  }): Promise<Result<SelectedNamesExportPreview, SelectedNamesExportError>>;
  build(input: {
    projectId: string;
    candidateIds?: string[];
    mode: SelectedNamesExportMode;
    format: SelectedNamesExportFormat;
    personalDataConfirmed?: boolean;
  }): Promise<Result<SelectedNamesExport, SelectedNamesExportError>>;
}

export interface SelectedExportPageProps {
  projectId: string;
  exporter: ExportActions;
  onDownloadJson: (document: SelectedNamesExport) => void;
  onPrint: (document: SelectedNamesExport) => void;
}

export function SelectedExportPage({
  projectId,
  exporter,
  onDownloadJson,
  onPrint,
}: SelectedExportPageProps) {
  const [mode, setMode] = useState<SelectedNamesExportMode>("share");
  const [candidateOptions, setCandidateOptions] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const [candidateIds, setCandidateIds] = useState<string[] | undefined>();
  const [preview, setPreview] = useState<SelectedNamesExportPreview>();
  const [personalConfirmed, setPersonalConfirmed] = useState(false);
  const [output, setOutput] = useState<SelectedNamesExport>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestSequence = useRef(0);
  const selectionKey = candidateIds?.join("\u0000") ?? "all";

  useEffect(() => {
    const sequence = ++requestSequence.current;
    void exporter
      .preview({ projectId, mode, ...(candidateIds ? { candidateIds } : {}) })
      .then((result) => {
        if (sequence !== requestSequence.current) return;
        if (!result.ok) {
          setError(exportErrorMessage(result.error));
          return;
        }
        setPreview(result.value);
        setError("");
        if (candidateOptions.length === 0 && candidateIds === undefined) {
          setCandidateOptions(
            result.value.candidateIds.map((id, index) => ({
              id,
              name: result.value.candidateNames[index] ?? id,
            })),
          );
          setCandidateIds(result.value.candidateIds);
        }
      })
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "无法读取精选导出预览。"),
      );
  }, [candidateIds, candidateOptions.length, exporter, mode, projectId, selectionKey]);

  const selectedSet = useMemo(() => new Set(candidateIds ?? []), [candidateIds]);
  const hiddenLabels = preview ? hiddenFieldLabels(preview) : [];
  const includedLabels = preview ? includedFieldLabels(preview) : [];

  async function exportDocument(format: SelectedNamesExportFormat) {
    if (mode === "personal" && !personalConfirmed) {
      setError("完整个人版包含敏感家庭信息，请先勾选确认。 ");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await exporter.build({
        projectId,
        candidateIds: candidateIds ?? [],
        mode,
        format,
        ...(mode === "personal" ? { personalDataConfirmed: personalConfirmed } : {}),
      });
      if (!result.ok) {
        setError(exportErrorMessage(result.error));
        return;
      }
      setOutput(result.value);
      if (format === "json") {
        onDownloadJson(result.value);
      } else {
        await afterNextPaint();
        onPrint(result.value);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "导出失败，请重试。 ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="selected-export-page">
      <header className="selected-export-hero no-print">
        <div>
          <p className="project-center__kicker">尔雅 · 精选成卷</p>
          <h1>精选导出中心</h1>
          <p>精选池不限数量。先核对姓名和字段范围，再生成打印版或 JSON。</p>
        </div>
        <div className="selected-export-hero__count" aria-label="当前导出数量">
          <span>本次收录</span>
          <strong>{preview?.selectedCount ?? 0}</strong>
          <span>共 {preview?.availableCount ?? 0} 个精选</span>
        </div>
      </header>

      <section
        className="selected-export-controls no-print"
        aria-labelledby="export-mode-title"
      >
        <div className="selected-export-section-heading">
          <span>01</span>
          <div>
            <h2 id="export-mode-title">选择信息范围</h2>
            <p>分享版默认脱敏；完整个人版只适合由你自己保存。</p>
          </div>
        </div>
        <div className="selected-export-mode-grid">
          <label className={mode === "share" ? "is-selected" : ""}>
            <input
              checked={mode === "share"}
              name="export-mode"
              onChange={() => {
                setMode("share");
                setPersonalConfirmed(false);
                setOutput(undefined);
              }}
              type="radio"
            />
            <strong>分享版</strong>
            <span>隐藏出生、四柱、亲属、生肖明细和备注。</span>
          </label>
          <label className={mode === "personal" ? "is-selected" : ""}>
            <input
              checked={mode === "personal"}
              name="export-mode"
              onChange={() => {
                setMode("personal");
                setOutput(undefined);
              }}
              type="radio"
            />
            <strong>完整个人版</strong>
            <span>包含已配置的敏感民俗与家庭信息。</span>
          </label>
        </div>
        {mode === "personal" ? (
          <label className="selected-export-confirmation">
            <input
              checked={personalConfirmed}
              onChange={(event) => setPersonalConfirmed(event.target.checked)}
              type="checkbox"
            />
            我确认此文件包含出生、四柱、亲属、生肖明细与个人备注，并由我自己保管。
          </label>
        ) : null}
      </section>

      <section
        className="selected-export-controls no-print"
        aria-labelledby="export-names-title"
      >
        <div className="selected-export-section-heading">
          <span>02</span>
          <div>
            <h2 id="export-names-title">选择精选姓名</h2>
            <p>默认全选；可导出 0 个、单个或任意数量，不设上限。</p>
          </div>
        </div>
        <div className="selected-export-selection-actions">
          <button
            onClick={() => setCandidateIds(candidateOptions.map(({ id }) => id))}
            type="button"
          >
            全选
          </button>
          <button onClick={() => setCandidateIds([])} type="button">
            清空选择
          </button>
        </div>
        <div className="selected-export-name-grid">
          {candidateOptions.map(({ id, name }) => (
            <label key={id}>
              <input
                checked={selectedSet.has(id)}
                onChange={(event) =>
                  setCandidateIds((current = []) =>
                    event.target.checked
                      ? [...current, id]
                      : current.filter((candidateId) => candidateId !== id),
                  )
                }
                type="checkbox"
              />
              <span>{name}</span>
            </label>
          ))}
          {candidateOptions.length === 0 ? <p>精选池目前没有名字。</p> : null}
        </div>
      </section>

      <section
        className="selected-export-preview no-print"
        aria-labelledby="export-preview-title"
      >
        <div className="selected-export-section-heading">
          <span>03</span>
          <div>
            <h2 id="export-preview-title">导出前预览</h2>
            <p>硬风险摘要始终保留，即使相关详情已隐藏。</p>
          </div>
        </div>
        <div className="selected-export-preview__grid">
          <article>
            <h3>将包含</h3>
            <ul>
              {includedLabels.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          </article>
          <article>
            <h3>{hiddenLabels.length ? "将隐藏" : "完整范围"}</h3>
            {hiddenLabels.length ? (
              <ul>
                {hiddenLabels.map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
            ) : (
              <p>已选择完整个人版，敏感字段会进入文件。</p>
            )}
          </article>
        </div>
        <p className="selected-export-risk-summary">
          已知硬风险 {preview?.hardRiskCount ?? 0} 条 · 民俗结果按当前方案所选体系与流派计算。
        </p>
        <div className="selected-export-actions">
          <Button disabled={busy} onClick={() => void exportDocument("print")} type="button">
            {busy ? "正在生成…" : "打印 / 保存 PDF"}
          </Button>
          <Button disabled={busy} onClick={() => void exportDocument("json")} type="button">
            {busy ? "正在生成…" : "下载 JSON"}
          </Button>
        </div>
        {error ? <p role="alert">{error}</p> : null}
      </section>

      {output ? <SelectedExportDocumentView document={output} /> : null}
    </main>
  );
}

export function SelectedExportDocumentView({ document }: { document: SelectedNamesExport }) {
  return (
    <article className="selected-export-document" aria-label="精选导出文档">
      <header>
        <p>ERYA · {document.mode === "share" ? "分享版" : "完整个人版"}</p>
        <h1>{document.project.title}</h1>
        <p>
          精选 {document.candidates.length} 个 · 生成于 {document.generatedAt}
        </p>
      </header>
      {document.privateData?.birth ? (
        <section>
          <h2>个人历法信息</h2>
          <p>出生：{document.privateData.birth.localDateTime}</p>
          {document.privateData.fourPillars?.length ? (
            <p>四柱：{document.privateData.fourPillars.join(" · ")}</p>
          ) : null}
          {document.privateData.zodiacDetails ? (
            <p>
              生肖明细：农历 {document.privateData.zodiacDetails.lunar ?? "未定"} · 干支年
              {document.privateData.zodiacDetails.pillar ?? "未定"}
            </p>
          ) : null}
        </section>
      ) : null}
      {document.candidates.map((candidate, index) => (
        <section className="selected-export-document__candidate" key={candidate.id}>
          <div>
            <span>
              {index + 1} / {document.candidates.length}
            </span>
            <h2>{candidate.fullName}</h2>
            <p>{candidate.pinyin.join(" · ")}</p>
          </div>
          <p>{candidate.summary}</p>
          {candidate.score?.totalScore !== undefined ? (
            <p>
              综合分 {candidate.score.totalScore.toFixed(1)} · 完整度
              {Math.round(candidate.score.completeness * 100)}%
            </p>
          ) : null}
          {candidate.hardRisks.length ? (
            <aside aria-label={`${candidate.fullName}硬风险`}>
              <h3>硬风险</h3>
              {candidate.hardRisks.map((risk) => (
                <p key={`${risk.moduleId}:${risk.ruleId}`}>{risk.explanation}</p>
              ))}
            </aside>
          ) : (
            <p>无已知硬冲突</p>
          )}
          {candidate.evaluation?.note ? <p>个人备注：{candidate.evaluation.note}</p> : null}
        </section>
      ))}
      <footer>{document.disclaimer}</footer>
    </article>
  );
}

function includedFieldLabels(preview: SelectedNamesExportPreview): string[] {
  return [
    `${preview.selectedCount} 个精选姓名`,
    "姓名、读音、释义与来源",
    "综合分、完整度和当前显示的规则证据",
    "全部已知硬风险摘要",
    ...(preview.visibility.notes ? ["个人评价与备注"] : ["个人评分（不含备注）"]),
  ];
}

function hiddenFieldLabels(preview: SelectedNamesExportPreview): string[] {
  const fields = [
    [preview.visibility.birthData, "出生日期与时辰"],
    [preview.visibility.fourPillars, "四柱信息"],
    [preview.visibility.relatives, "亲属姓名与避讳明细"],
    [preview.visibility.zodiacDetails, "生肖明细"],
    [preview.visibility.notes, "方言、用神与候选备注"],
  ] as const;
  return fields.filter(([visible]) => !visible).map(([, label]) => label);
}

function exportErrorMessage(error: SelectedNamesExportError): string {
  switch (error) {
    case "project-not-found":
      return "未找到起名方案。";
    case "candidate-not-selected":
      return "选择中包含已不在精选池的名字，请刷新后重试。";
    case "personal-export-confirmation-required":
      return "完整个人版包含敏感家庭信息，请先勾选确认。";
  }
}

function afterNextPaint(): Promise<void> {
  return new Promise((resolve) =>
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())),
  );
}
