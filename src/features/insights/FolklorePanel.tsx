import type { NamingProfile } from "../../domain/project/profile";
import {
  calculateBasicFiveElements,
  elementLabels,
  type FiveElement,
} from "../../domain/folklore/calendarAdapter";
import { sourceCatalog } from "../../data/sourceCatalog";
import "./insights.css";
export function FolklorePanel({ profile }: { profile: Pick<NamingProfile, "folklore"> }) {
  const folklore = profile.folklore;
  if (!folklore.enabled)
    return (
      <div className="insight-note">
        <strong>民俗参考未开启</strong>
        <p>可在起名条件中开启。名字的语言、出处与读写检查独立保留。</p>
      </div>
    );
  if (!folklore.birthLocalDateTime)
    return (
      <div className="insight-note">
        <strong>出生信息待补充</strong>
        <p>
          已开启文化参考；补充日期后可查看农历、节气与四柱。也可以先按家人指定的五行意象选名。
        </p>
      </div>
    );
  let result;
  try {
    result = calculateBasicFiveElements({
      localDateTime: folklore.birthLocalDateTime,
      timeZone: folklore.timeZone ?? "Asia/Shanghai",
      ...(folklore.dayBoundary ? { dayBoundary: folklore.dayBoundary } : {}),
      ...(folklore.timeKnown !== undefined ? { timeKnown: folklore.timeKnown } : {}),
    });
  } catch (error) {
    return (
      <p role="alert">
        {error instanceof Error ? error.message : "暂时无法计算，请检查出生信息"}
      </p>
    );
  }
  const total = result.timeKnown ? 8 : 6;
  return (
    <section className="folklore-panel" aria-label="民俗参考报告">
      <div className="insight-heading">
        <div>
          <span className="eyebrow">时序 · 节律</span>
          <h3>出生时序与传统参考</h3>
        </div>
        <span className="ui-status">中国标准时间 · UTC+8</span>
      </div>
      <p>
        {result.lunarDate} · 农历生肖{result.lunarZodiac} · 四柱年支生肖{result.pillarZodiac}
      </p>
      <p className="insight-note">
        {result.disclaimer} 以下说明文化规则的计算过程，不用于推断健康、事业、婚姻或命运。
      </p>
      <div className="pillar-grid">
        {result.columns.map((column) => (
          <div key={column.label}>
            <span>{column.label}</span>
            <strong>{column.pillar}</strong>
            <span>{column.elements}</span>
            <small>藏干 {column.hiddenStems.join("、")}</small>
            <small>纳音 {column.naYin}</small>
          </div>
        ))}
        {!result.timeKnown ? (
          <div>
            <span>时柱</span>
            <strong>待定</strong>
            <small>时辰不详，不补算</small>
          </div>
        ) : null}
      </div>
      <p>
        日主：{result.dayMaster}（{result.dayMasterElement}）· {result.convention}
      </p>
      <div className="element-bars">
        {(Object.entries(result.distribution) as [FiveElement, number][]).map(
          ([element, count]) => (
            <div key={element}>
              <span>{elementLabels[element]}</span>
              <div>
                <i data-element={element} style={{ width: `${(count / total) * 100}%` }} />
              </div>
              <strong>{count}</strong>
            </div>
          ),
        )}
      </div>
      <p>
        表层计数：木 {result.distribution.wood} · 火 {result.distribution.fire} · 土{" "}
        {result.distribution.earth} · 金 {result.distribution.metal} · 水{" "}
        {result.distribution.water}
      </p>
      <details>
        <summary>怎么看四柱、五行、藏干与纳音</summary>
        <dl className="insight-definitions">
          <dt>四柱与节气</dt>
          <dd>
            年、月、日、时各以一组干支表达。月柱按十二个“节”交接，不按农历初一换月。上一节：
            {result.previousJie.name} {result.previousJie.time}；下一节：{result.nextJie.name}{" "}
            {result.nextJie.time}。
          </dd>
          <dt>藏干</dt>
          <dd>
            地支在传统规则中的内部天干对应，另列以便核对。本图不将藏干重复相加，也不赋予季节旺衰权重。
          </dd>
          <dt>纳音</dt>
          <dd>
            六十甲子的另一套传统分类，与天干地支本身的五行是不同层面的标签，不应混合计数。
          </dd>
          <dt>喜用与取名</dt>
          <dd>
            表层五行数量不能决定喜用神。不同流派会考虑月令、根气、组合等条件；本工具不自动给出喜用结论。你可以明确选择家人希望采用的五行意象。
          </dd>
        </dl>
        <ul>
          {result.caveats.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        <p>计算实现：{result.library}</p>
      </details>
      <p className="source-links">
        {["hko-calendar", "hko-year", "lunar-typescript"].map((id) => (
          <a key={id} href={sourceCatalog[id]!.url} target="_blank" rel="noreferrer">
            {sourceCatalog[id]!.title} ↗
          </a>
        ))}
      </p>
    </section>
  );
}
