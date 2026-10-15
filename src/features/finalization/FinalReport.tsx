import { ZodiacAdvisory } from "../insights/ZodiacAdvisory";
import { lazy, Suspense } from "react";
import { readSurname, nameSoundNotes } from "../../domain/candidate/nameReading";
import { activeRuntimeBundle } from "../../data/activeRuntimeBundle";
import { elementLabels } from "../../domain/folklore/fiveElements";
import type { FinalReportModel } from "../../application/models/FinalReportModel";
import { Card } from "../../design-system/primitives/Card";
const FolklorePanel = lazy(() =>
  import("../insights/FolklorePanel").then((module) => ({ default: module.FolklorePanel })),
);

export interface ReportRedactions {
  birthData?: boolean;
  avoidCharacters?: boolean;
  notes?: boolean;
  folklore?: boolean;
}

export function FinalReport({
  report,
  redactions,
}: {
  report: FinalReportModel;
  redactions: ReportRedactions;
}) {
  return (
    <article className="final-report">
      <header>
        <p className="project-center__kicker">ERYA FINAL REPORT</p>
        <h1>{report.projectTitle} · 定稿报告</h1>
        <p>最终说明：{report.rationale}</p>
      </header>
      {!redactions.birthData && report.privateData.birthLocalDateTime ? (
        <p>出生信息：{report.privateData.birthLocalDateTime}</p>
      ) : null}
      {!redactions.avoidCharacters && report.privateData.avoidCharacters.length ? (
        <p>避字：{report.privateData.avoidCharacters.join("、")}</p>
      ) : null}
      {!redactions.folklore && report.folkloreEnabled ? (
        <p>传统民俗参考已启用；不属于科学结论。</p>
      ) : null}
      {!redactions.folklore &&
      !redactions.birthData &&
      report.folkloreEnabled &&
      report.profile ? (
        <Suspense fallback={<p role="status">正在载入民俗参考…</p>}>
          <FolklorePanel profile={report.profile} />
        </Suspense>
      ) : null}
      {report.finalists.map((candidate, index) => (
        <Card className="final-report__candidate" key={candidate.id}>
          <div className="final-report__page-header">
            <span>{report.projectTitle} · 候选定稿</span>
            <span>
              候选 {index + 1} / 共 {report.finalists.length} 个
            </span>
          </div>
          <h2>{candidate.fullName}</h2>
          <p>
            {[
              ...(report.profile
                ? readSurname(report.profile.surname, report.profile.surnamePinyin)
                : []),
              ...candidate.pinyin,
            ].join(" · ")}
          </p>
          <p>{candidate.summary}</p>
          {candidate.id === report.selectedCandidateId ? <strong>最终选择</strong> : null}
          {candidate.characterEvidence?.length ? (
            <>
              <h3>逐字释义</h3>
              {candidate.characterEvidence.map((item, i) => (
                <p key={`${item.char}:${i}`}>
                  <strong>{item.char}</strong> · {item.pinyin[0]} · {item.meanings.join("；")}
                </p>
              ))}
            </>
          ) : null}
          <h3>音律与使用</h3>
          <p>
            {nameSoundNotes([
              ...(report.profile
                ? readSurname(report.profile.surname, report.profile.surnamePinyin)
                : []),
              ...candidate.pinyin,
            ]).join(" ")}
          </p>
          {!redactions.folklore && report.folkloreEnabled ? (
            <>
              <h3>名字的民俗意象</h3>
              {[...(candidate.givenName ?? "")].map((char, i) => {
                const entry = activeRuntimeBundle.characters.find((item) => item.char === char);
                return (
                  <p key={`${char}:${i}`}>
                    {char}：
                    {entry?.element
                      ? `${elementLabels[entry.element]} · ${entry.elementReason}`
                      : "字义五行未定，不强行归类。"}
                  </p>
                );
              })}
              <p>传统民俗参考，非科学结论；不由名字预测健康、事业或人生。</p>
            </>
          ) : null}
          {!redactions.folklore && !redactions.birthData && report.profile && (
            <ZodiacAdvisory
              givenName={candidate.givenName ?? ""}
              folklore={report.profile.folklore}
            />
          )}
          {candidate.sources
            .filter(
              (source) =>
                source.quote ||
                source.sourceId === "user-input" ||
                source.title?.includes("状元用名"),
            )
            .map((source) => (
              <blockquote key={`${candidate.id}:${source.sourceId}`}>
                {source.work ? <cite>{source.work}</cite> : null}
                {source.quote ?? source.excerpt ?? source.location ?? source.sourceId}
                {source.url && (
                  <p>
                    <a href={source.url} target="_blank" rel="noreferrer">
                      核对来源
                    </a>
                    {source.revision ? ` · ${source.revision}` : ""}
                  </p>
                )}
              </blockquote>
            ))}
          {candidate.sources
            .filter((source) => source.sourceId === "erya-modern-20260927")
            .map((source) => (
              <p key={source.sourceId}>使用建议：{source.excerpt}</p>
            ))}
          {candidate.warnings.map((warning) => (
            <p key={`${warning.ruleId}:${warning.explanation}`}>风险：{warning.explanation}</p>
          ))}
          {candidate.rating ? <p>个人评分：{candidate.rating} 分</p> : null}
          {!redactions.notes && candidate.note ? <p>备注：{candidate.note}</p> : null}
        </Card>
      ))}
    </article>
  );
}
