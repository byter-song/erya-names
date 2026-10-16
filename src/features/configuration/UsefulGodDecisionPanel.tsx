import type { FiveElement } from "../../domain/folklore/fiveElements";
import type { analyzeUsefulGod } from "../../domain/folklore/usefulGod";
import type { NamingProfile } from "../../domain/project/profile";

type UsefulGodAnalysis = ReturnType<typeof analyzeUsefulGod>;

const elementLabels: Record<FiveElement, string> = {
  wood: "木",
  fire: "火",
  earth: "土",
  metal: "金",
  water: "水",
};

const applicabilityLabels: Record<UsefulGodAnalysis["paths"][number]["applicability"], string> =
  {
    applied: "产品公式已审计 · 研究模型",
    not_applicable: "当前不适用",
    missing_input: "资料不足",
    source_unverified: "来源待复核",
  };

export function UsefulGodDecisionPanel({
  analysis,
  value,
  onChange,
  now = () => new Date().toISOString(),
}: {
  analysis?: UsefulGodAnalysis;
  value?: NamingProfile["usefulGodDecision"];
  onChange: (value: NamingProfile["usefulGodDecision"] | undefined) => void;
  now?: () => string;
}) {
  const selected = value?.confirmedElements ?? [];
  const suggested = analysis?.consensus.candidateElements ?? [];

  if (!analysis)
    return (
      <section aria-labelledby="useful-god-title">
        <h3 id="useful-god-title">用神多路径建议</h3>
        <p role="status">填写出生日期并启用八字五行后，先查看各路径证据，再确认采用元素。</p>
      </section>
    );

  return (
    <section aria-labelledby="useful-god-title">
      <h3 id="useful-god-title">用神多路径建议</h3>
      <p className="configuration-note">
        按所选传统体系与流派分别呈现四条路径；结论会随历法口径、资料完整度和流派变化。
      </p>
      <p>
        路径汇总：{analysis.consensus.explanation}
        产品公式与输入边界已完成审计，流派结论仍为低置信度研究模型，采用项需由你确认。
      </p>
      <div className="useful-god-decision-summary">
        <strong>当前共同建议</strong>
        <span>
          {suggested.length
            ? suggested.map((element) => elementLabels[element]).join("、")
            : "各路径尚未形成可采用的共同建议"}
        </span>
        {suggested.length ? (
          <button
            type="button"
            onClick={() =>
              onChange({
                confirmedElements: suggested,
                confirmedAt: now(),
                ...(value?.note ? { note: value.note } : {}),
              })
            }
          >
            采用当前建议
          </button>
        ) : null}
      </div>

      <div className="configuration-evidence-list">
        {analysis.paths.map((path) => (
          <details key={path.pathId}>
            <summary>
              {path.label} · {applicabilityLabels[path.applicability]} · 置信度
              {path.confidence === "low" ? "低" : "不足"}
            </summary>
            <p>
              建议候选：
              {path.recommendedElements.map((element) => elementLabels[element]).join("、") ||
                "无"}
            </p>
            <h4>支持证据</h4>
            <ul>
              {path.evidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h4>反证与限制</h4>
            <ul>
              {path.counterEvidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p>来源：{path.sourceIds.join("、")}</p>
          </details>
        ))}
      </div>

      <fieldset>
        <legend>查看上述证据后，确认纳入名字匹配分的五行</legend>
        {(Object.keys(elementLabels) as FiveElement[]).map((element) => (
          <label key={element}>
            <input
              checked={selected.includes(element)}
              onChange={(event) => {
                const next = event.currentTarget.checked
                  ? [...selected, element]
                  : selected.filter((item) => item !== element);
                onChange(
                  next.length
                    ? {
                        confirmedElements: next,
                        confirmedAt: now(),
                        ...(value?.note ? { note: value.note } : {}),
                      }
                    : undefined,
                );
              }}
              type="checkbox"
            />
            {elementLabels[element]}
          </label>
        ))}
      </fieldset>
      {selected.length ? (
        <p role="status">
          已确认：{selected.map((element) => elementLabels[element]).join("、")}
        </p>
      ) : (
        <p role="status">尚未确认；八字五行名字匹配维度保持资料不足。</p>
      )}
    </section>
  );
}
