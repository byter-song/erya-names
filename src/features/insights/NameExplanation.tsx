import type { CandidateFunnelItem } from "../../application/models/CandidateFunnelItem";
import type { NamingProfile } from "../../domain/project/profile";
import { activeRuntimeBundle } from "../../data/activeRuntimeBundle";
import writingStrokes from "../../data/curated/writing-strokes.json";
import { sourceCatalog } from "../../data/sourceCatalog";
import { nameSoundNotes, readSurname } from "../../domain/candidate/nameReading";
import { elementLabels } from "../../domain/folklore/calendarAdapter";
import { matchPersonUsages } from "../../domain/person/matchPersonUsages";
import { FolklorePanel } from "./FolklorePanel";
import { FiveGridsPanel } from "./FiveGridsPanel";
import "./insights.css";
const entries = new Map(activeRuntimeBundle.characters.map((entry) => [entry.char, entry]));
const strokes: Record<string, number> = writingStrokes;
export function NameExplanation({
  candidate,
  profile,
}: {
  candidate: CandidateFunnelItem;
  profile?: NamingProfile | undefined;
}) {
  const givenName =
    candidate.givenName ?? candidate.fullName.slice(profile?.surname.length ?? 1);
  const surname = candidate.fullName.slice(0, candidate.fullName.length - givenName.length);
  const reading = [
    ...readSurname(surname, surname === profile?.surname ? profile.surnamePinyin : undefined),
    ...candidate.pinyin,
  ];
  const evidence = candidate.characterEvidence?.length
    ? candidate.characterEvidence
    : [...givenName].map((char) => ({
        char,
        pinyin: entries.get(char)?.pinyin ?? [],
        meanings: entries.get(char)?.meanings ?? [],
        sourceRefs: [],
      }));
  const modernNote = candidate.sourceEvidence?.find(
    (source) => source.sourceId === "erya-modern-20260927",
  )?.excerpt;
  const quotes = (candidate.sourceEvidence ?? []).filter((source) => source.quote);
  const personUsages = matchPersonUsages(candidate.fullName, activeRuntimeBundle.personUsages);
  const identityLabels = {
    historical_person: "历史人物",
    zhuangyuan: "科举记录 · 状元",
    bangyan: "科举记录 · 榜眼",
    tanhua: "科举记录 · 探花",
    jinshi: "科举记录 · 进士",
  } as const;
  return (
    <div className="name-explanation">
      <div className="name-explanation__hero">
        <span className="eyebrow">一名一章 · 释名笺</span>
        <p className="name-explanation__name">{candidate.fullName}</p>
        <p>{reading.join(" · ")}</p>
        <p>{candidate.summary}</p>
      </div>
      <h3>逐字读懂</h3>
      <div className="character-grid">
        {evidence.map((item, i) => {
          const entry = entries.get(item.char);
          return (
            <section key={`${item.char}:${i}`}>
              <strong>{item.char}</strong>
              <span>{item.pinyin[0] ?? "读音待核"}</span>
              <p>{item.meanings.join("；") || "暂无可核对的单字说明，请人工补充。"}</p>
              <small>
                {entry?.strokes ? `简体书写 ${entry.strokes} 画` : "笔画待核对"}
                {item.pinyin.length > 1
                  ? ` · 另有读音 ${item.pinyin.slice(1).join(" / ")}`
                  : ""}
              </small>
            </section>
          );
        })}
      </div>
      <h3>出处与取意</h3>
      {quotes.length ? (
        quotes.map((source, i) => {
          const info = sourceCatalog[source.sourceId];
          return (
            <blockquote key={`${source.sourceId}:${i}`}>
              <p>「{source.quote}」</p>
              <cite>
                {source.work} · {source.location ?? source.title}
              </cite>
              <p className="muted">
                {source.quote?.includes(givenName)
                  ? "取原文连续文字"
                  : "由同一原句依次取字；不是原句中的连续词语"}
                。现代取名寓意是在原文基础上的引申。
              </p>
              {info ? (
                <a href={info.url} target="_blank" rel="noreferrer">
                  核对古籍原文 ↗
                </a>
              ) : (
                <span>历史来源记录：{source.sourceId}</span>
              )}
            </blockquote>
          );
        })
      ) : (
        <p>
          现代组合命名：依照单字含义与家庭偏好组合，不宣称整名出自某篇古籍。你可以将喜欢的现代名字保留在候选集。
        </p>
      )}
      <h3>全名音律与日常使用</h3>
      <ul>
        {nameSoundNotes(reading).map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
      <p>
        推荐试用：你好，我叫{candidate.fullName}。／{candidate.fullName}，请签到。／{givenName}
        ，回家啦。
      </p>
      {personUsages.length ? (
        <>
          <h3>历史用名参考</h3>
          <p className="insight-note">
            以下内容仅表示历史上存在完整同名记录，不构成名字寓意、人物评价或人生结果判断，也不参与评分和排序。
          </p>
          {personUsages.map((usage) => (
            <section key={usage.id}>
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
            </section>
          ))}
        </>
      ) : null}
      <h3>需要一起考虑</h3>
      {modernNote ? <p className="insight-note">{modernNote}</p> : null}
      <ul>
        {candidate.warnings.map((warning, i) => (
          <li key={i}>{warning.explanation}</li>
        ))}
        <li>常见度、重名人数与全国登记结果未接入实时数据，不能由匹配分推断。</li>
        {profile?.dialectNotes ? <li>家庭方言备忘：{profile.dialectNotes}</li> : null}
        {profile?.surnameType === "combined_parental" ? (
          <li>父母组合姓需先向当地户籍机关核对登记依据；通过规范字检查并不代表可以登记。</li>
        ) : null}
      </ul>
      <details>
        <summary>为什么推荐 · 查看匹配依据</summary>
        <p>分数只表示当前家庭偏好，不表示名字的客观优劣；历史候选保留生成时的条件与评分。</p>
        <ul>
          {candidate.scoreEvidence?.map((rule) => (
            <li key={rule.ruleId}>
              {rule.explanation}（{rule.scoreDelta >= 0 ? "+" : ""}
              {rule.scoreDelta}）
            </li>
          ))}
        </ul>
      </details>
      {profile?.folklore.enabled ? (
        <>
          <h3>这个名字的民俗解释</h3>
          <p className="insight-note">
            传统民俗参考，非科学结论。字义五行采用本项目可说明的自然意象口径；未采用偏旁“一刀切”，也不混用纳音、八字或数理五行。
          </p>
          {[...givenName].map((char, i) => {
            const entry = entries.get(char);
            return (
              <p key={`${char}:${i}`}>
                <strong>
                  {char} · {entry?.element ? elementLabels[entry.element] : "不强行定五行"}
                </strong>
                ：
                {entry?.elementReason ??
                  "没有足够明确的自然意象依据。不同字典和姓名学流派可能给出不同归类，本包保留未知。"}
                {entry?.element && profile.folklore.usefulElements.includes(entry.element)
                  ? " 符合你指定的五行意象。"
                  : ""}
              </p>
            );
          })}
          <p>
            你指定的五行：
            {profile.folklore.usefulElements.map((e) => elementLabels[e]).join("、") ||
              "暂不采用"}
            。
            {profile.folklore.includeInRanking ? "生成时作为软偏好参与排序。" : "不参与排序。"}
          </p>
          <FolklorePanel profile={profile} />
          <FiveGridsPanel surname={surname} givenName={givenName} strokes={strokes} />
        </>
      ) : (
        <p className="insight-note">民俗解释默认关闭，可在起名条件中选择开启。</p>
      )}
      <details>
        <summary>核对历史规则记录</summary>
        <ul>
          {(candidate.ruleEvidence ?? []).map((rule, i) => (
            <li key={i}>
              {rule.explanation}
              <small>
                {" "}
                · {rule.ruleId} · {rule.ruleVersion} · {rule.sourceRefs.join("、")}
              </small>
            </li>
          ))}
        </ul>
      </details>
      <details>
        <summary>资料版本与核验说明</summary>
        <p>
          本次个人字库：{activeRuntimeBundle.manifest.version}
          。古籍原文、规范字和读音已进行机器交叉核验；释义由 AI
          独立整理，未经专家逐条人工审校。选定前请核对原句、实际姓氏读音和家庭习惯。
        </p>
        <p className="source-links">
          {["standard-hanzi-2013", "pinyin-data", "civil-code"].map((id) => (
            <a key={id} href={sourceCatalog[id]!.url} rel="noreferrer" target="_blank">
              {sourceCatalog[id]!.title} ↗
            </a>
          ))}
        </p>
      </details>
    </div>
  );
}
