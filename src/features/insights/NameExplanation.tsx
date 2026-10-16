import type { CandidateFunnelItem } from "../../application/models/CandidateFunnelItem";
import { activeRuntimeBundle } from "../../data/activeRuntimeBundle";
import type { NamingProfile } from "../../domain/project/profile";
import { matchPersonUsages } from "../../domain/person/matchPersonUsages";
import type { EvidenceStatus, RuleEvidence, RuleModuleId } from "../../domain/rules/result";
import { readSurname } from "../../domain/candidate/nameReading";
import { ZodiacAdvisory } from "./ZodiacAdvisory";
import "./insights.css";

const moduleLabels: Record<RuleModuleId, string> = {
  basic: "基础规范",
  bazi_wuxing: "八字五行",
  zodiac: "生肖提示",
  traditional: "传统起名原则",
  name_hexagram: "姓名卦象",
  five_grids: "五格数理",
};

const statusLabels: Record<CandidateFunnelItem["hardStatus"], string> = {
  pass: "通过",
  notice: "有提示",
  conflict: "有冲突",
  unknown: "待补充",
};

const evidenceStatusLabels: Record<EvidenceStatus, string> = {
  pass: "符合",
  notice: "有提示",
  conflict: "不符合",
  unknown: "暂无法判断",
};

const applicabilityLabels: Record<RuleEvidence["applicability"], string> = {
  applied: "已应用",
  not_applicable: "不适用于当前名字",
  missing_input: "缺少必要输入",
  source_unverified: "资料尚未完成复核",
};

const identityLabels = {
  historical_person: "历史人物",
  zhuangyuan: "科举记录 · 状元",
  bangyan: "科举记录 · 榜眼",
  tanhua: "科举记录 · 探花",
  jinshi: "科举记录 · 进士",
} as const;

export function NameExplanation({
  candidate,
  profile,
  showFolklore = false,
  evidence = [],
  hiddenEvidenceCount = 0,
}: {
  candidate: CandidateFunnelItem;
  profile?: NamingProfile;
  showFolklore?: boolean;
  evidence?: RuleEvidence[];
  hiddenEvidenceCount?: number;
}) {
  const givenName =
    candidate.givenName ?? candidate.fullName.slice(profile?.basics.surname.length ?? 1);
  const surname = candidate.fullName.slice(0, candidate.fullName.length - givenName.length);
  const reading = [
    ...readSurname(
      surname,
      surname === profile?.basics.surname ? profile.basics.surnamePinyin : undefined,
    ),
    ...candidate.pinyin,
  ];
  const moduleScores = Object.entries(candidate.moduleScores ?? {}) as Array<
    [RuleModuleId, number | undefined]
  >;
  const personUsages = matchPersonUsages(candidate.fullName, activeRuntimeBundle.personUsages);
  const evidenceByModule = evidence.reduce<Map<RuleModuleId, RuleEvidence[]>>(
    (groups, item) => {
      const current = groups.get(item.moduleId) ?? [];
      current.push(item);
      groups.set(item.moduleId, current);
      return groups;
    },
    new Map(),
  );

  return (
    <div className="name-explanation">
      <div className="name-explanation__hero">
        <span className="eyebrow">一名一章 · 释名笺</span>
        <p className="name-explanation__name">{candidate.fullName}</p>
        <p>{reading.join(" · ")}</p>
        <p>{candidate.summary}</p>
      </div>

      <section aria-labelledby="score-summary-title">
        <h3 id="score-summary-title">综合评估</h3>
        <dl>
          <dt>基础状态</dt>
          <dd>{statusLabels[candidate.hardStatus]}</dd>
          <dt>{candidate.completeness < 1 ? "暂定综合分" : "综合分"}</dt>
          <dd>
            {candidate.scoringPending ? "分析中" : `${formatScore(candidate.totalScore)}/100`}
          </dd>
          <dt>分析完整度</dt>
          <dd>{Math.round(candidate.completeness * 100)}%</dd>
        </dl>
        {(candidate.hiddenScoredModuleCount ?? 0) > 0 ? (
          <p className="insight-note">
            有 {candidate.hiddenScoredModuleCount} 个模块已纳入评分，但按方案设置隐藏详情。
          </p>
        ) : null}
        {candidate.topDeductions?.length ? (
          <ul>
            {candidate.topDeductions.map((item) => (
              <li key={item.ruleId}>
                {item.explanation}（扣 {item.deduction} 分）
              </li>
            ))}
          </ul>
        ) : (
          <p>当前已完成的规则中没有主要扣分项。</p>
        )}
      </section>

      {showFolklore && profile ? (
        <section aria-labelledby="folklore-title" className="folklore-overview">
          <h3 id="folklore-title">民俗分析总览</h3>
          <p className="insight-note">
            按当前方案选择的传统体系与流派计算；结论会随历法口径、资料完整度和流派变化。
          </p>
          <ZodiacAdvisory
            givenName={givenName}
            profile={profile}
            evidence={evidenceByModule.get("zodiac") ?? []}
          />
          <ul>
            {(
              Object.entries(profile.modules) as Array<
                [
                  keyof NamingProfile["modules"],
                  NamingProfile["modules"][keyof NamingProfile["modules"]],
                ]
              >
            ).map(([moduleId, settings]) => (
              <li key={moduleId}>
                <strong>{moduleLabels[moduleId]}</strong>：
                {settings.analysisEnabled
                  ? candidate.moduleScores[moduleId] === undefined
                    ? "已启用，当前缺少必要资料"
                    : `已纳入综合分，模块得分 ${candidate.moduleScores[moduleId]}/100`
                  : "当前未启用"}
                ；{settings.detailsVisible ? "详情可见" : "详情已隐藏"}。
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="evidence-title" className="rule-evidence">
        <h3 id="evidence-title">规则证据与扣分过程</h3>
        <p className="muted">
          每条结论都保留适用条件、计算过程、所选流派和来源编号，便于逐项核对。
        </p>
        {hiddenEvidenceCount > 0 ? (
          <p className="insight-note" role="status">
            另有 {hiddenEvidenceCount} 条证据已参与当前结果，但按方案的“详情显示”设置隐藏。
          </p>
        ) : null}
        {evidenceByModule.size ? (
          [...evidenceByModule.entries()].map(([moduleId, items]) => (
            <section
              key={moduleId}
              className="rule-evidence__module"
              aria-labelledby={`evidence-${moduleId}`}
            >
              <h4 id={`evidence-${moduleId}`}>{moduleLabels[moduleId]}</h4>
              {items.map((item) => (
                <details key={item.id} className="rule-evidence__item">
                  <summary>
                    <span>{item.explanation}</span>
                    <span className="rule-evidence__status" data-status={item.status}>
                      状态：{evidenceStatusLabels[item.status]}
                    </span>
                  </summary>
                  <dl className="rule-evidence__facts">
                    <dt>适用性</dt>
                    <dd>{applicabilityLabels[item.applicability]}</dd>
                    <dt>规则性质</dt>
                    <dd>
                      {item.severity === "hard"
                        ? "硬性状态规则，不参与加权扣分"
                        : "软性评分规则"}
                    </dd>
                    <dt>输入摘要</dt>
                    <dd>{item.inputSummary}</dd>
                    <dt>扣分链</dt>
                    <dd>
                      {item.scoreBefore !== undefined &&
                      item.deduction !== undefined &&
                      item.scoreAfter !== undefined
                        ? `${item.scoreBefore} − ${item.deduction} = ${item.scoreAfter}`
                        : "本条不形成数值扣分"}
                    </dd>
                    <dt>计算说明</dt>
                    <dd>
                      {item.calculation.length ? (
                        <ol>
                          {item.calculation.map((step, index) => (
                            <li key={`${item.id}:calculation:${index}`}>{step}</li>
                          ))}
                        </ol>
                      ) : (
                        "没有额外计算步骤"
                      )}
                    </dd>
                    <dt>规则与版本</dt>
                    <dd>
                      {item.ruleId} · {item.ruleVersion}
                      {item.schoolId ? ` · ${item.schoolId}` : ""}
                    </dd>
                    <dt>来源编号</dt>
                    <dd>
                      {item.sourceIds.length ? item.sourceIds.join("、") : "暂无可核验来源"}
                    </dd>
                    <dt>不确定性</dt>
                    <dd>{item.uncertainty ?? "未记录额外不确定性"}</dd>
                  </dl>
                </details>
              ))}
            </section>
          ))
        ) : (
          <p>当前还没有可展示的规则证据。</p>
        )}
      </section>

      <section aria-labelledby="module-score-title">
        <h3 id="module-score-title">分模块得分</h3>
        {moduleScores.length ? (
          <dl>
            {moduleScores.map(([moduleId, score]) => (
              <div key={moduleId}>
                <dt>{moduleLabels[moduleId]}</dt>
                <dd>{score === undefined ? "待评估" : `${score}/100`}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p>当前还没有可展示的分模块结果。</p>
        )}
      </section>

      <section aria-labelledby="source-title">
        <h3 id="source-title">出处与灵感</h3>
        {candidate.sourceEvidence.length ? (
          <ul>
            {candidate.sourceEvidence.map((source) => (
              <li key={source.sourceId}>
                <strong>{source.title ?? source.sourceId}</strong>
                {source.quote ? `：“${source.quote}”` : ""}
                {source.excerpt ? ` — ${source.excerpt}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p>这个名字暂时没有可核验的典故出处，按现代组合解释。</p>
        )}
      </section>

      {personUsages.length ? (
        <section aria-labelledby="person-usage-title">
          <h3 id="person-usage-title">历史用名参考</h3>
          <p className="insight-note">
            以下内容仅表示历史上存在完整同名记录，不构成名字寓意、人物评价或人生结果判断，也不参与评分和排序。
          </p>
          {personUsages.map((usage) => (
            <article key={usage.id} className="person-usage">
              <p>
                <strong>{usage.name}</strong> · {usage.period} ·{" "}
                {identityLabels[usage.identityType]}
              </p>
              <p>{usage.description}</p>
              {usage.rankEvidence ? <p>科举名次依据：{usage.rankEvidence}</p> : null}
              <p className="source-links">
                {usage.sourceRefs.map((source) =>
                  source.url ? (
                    <a
                      key={`${usage.id}:${source.sourceId}:${source.location}`}
                      href={source.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      核对记录 ↗
                    </a>
                  ) : (
                    <span key={`${usage.id}:${source.sourceId}:${source.location}`}>
                      {source.sourceId} · {source.location}
                    </span>
                  ),
                )}
              </p>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function formatScore(score: number | undefined): string {
  return score === undefined ? "—" : Number(score.toFixed(1)).toString();
}
