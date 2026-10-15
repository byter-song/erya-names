import { useState } from "react";
import type { NamingProfile } from "../../domain/project/profile";
import { zodiacAnimals, type ZodiacRule } from "../../domain/folklore/zodiacAdvisory";
export function ZodiacRuleEditor({
  folklore,
  onChange,
}: {
  folklore: NamingProfile["folklore"];
  onChange: (patch: Partial<NamingProfile["folklore"]>) => void;
}) {
  const [draft, setDraft] = useState<ZodiacRule>({
    zodiac: "马",
    characters: "",
    position: "start",
    explanation: "",
    source: "",
  });
  const rules = folklore.zodiacRules ?? [];
  return (
    <section className="wide-field">
      <h4>生肖选字 · 只提醒</h4>
      <p>
        不同家庭和流派的宜忌可能相反。这里保存你采用的口径与来源，不预置无统一依据的宜忌字表。姓名中的“首字”不包括姓氏。
      </p>
      <label className="ui-field">
        <span>生肖换年口径</span>
        <select
          value={folklore.zodiacConvention ?? "lunar"}
          onChange={(e) => onChange({ zodiacConvention: e.target.value as "lunar" | "pillar" })}
        >
          <option value="lunar">农历正月初一</option>
          <option value="pillar">立春交节（四柱年支）</option>
        </select>
      </label>
      <details>
        <summary>添加家庭生肖提醒</summary>
        <div className="studio-fields">
          <label>
            适用生肖
            <select
              value={draft.zodiac}
              onChange={(e) =>
                setDraft({ ...draft, zodiac: e.target.value as ZodiacRule["zodiac"] })
              }
            >
              {zodiacAnimals.map((z) => (
                <option key={z}>{z}</option>
              ))}
            </select>
          </label>
          <label>
            检查位置
            <select
              value={draft.position}
              onChange={(e) =>
                setDraft({ ...draft, position: e.target.value as "start" | "any" })
              }
            >
              <option value="start">名字首字</option>
              <option value="any">名字任意位置</option>
            </select>
          </label>
          <label>
            提醒字表
            <input
              value={draft.characters}
              maxLength={100}
              placeholder="逐字填写，例如：明晴"
              onChange={(e) => setDraft({ ...draft, characters: e.target.value })}
            />
          </label>
          <label>
            提醒内容
            <input
              value={draft.explanation}
              maxLength={300}
              placeholder="写明家人采用的宜忌或部件说法"
              onChange={(e) => setDraft({ ...draft, explanation: e.target.value })}
            />
          </label>
          <label>
            来源与口径
            <input
              value={draft.source}
              maxLength={300}
              placeholder="书名、页码、链接或家人口述"
              onChange={(e) => setDraft({ ...draft, source: e.target.value })}
            />
          </label>
        </div>
        <button
          type="button"
          disabled={
            rules.length >= 30 ||
            !/^\p{Script=Han}+$/u.test(draft.characters) ||
            !draft.explanation.trim() ||
            !draft.source.trim()
          }
          onClick={() => {
            onChange({ zodiacRules: [...rules, draft] });
            setDraft({ ...draft, characters: "", explanation: "", source: "" });
          }}
        >
          加入提醒草稿
        </button>
        <p>加入后，请点击下方保存按钮。</p>
      </details>
      {rules.map((rule, i) => (
        <p key={i}>
          属{rule.zodiac} · {rule.position === "start" ? "首字" : "任意位置"} ·{" "}
          {rule.characters}：{rule.explanation}（{rule.source}）{" "}
          <button
            type="button"
            aria-label={`删除第${i + 1}条生肖提醒`}
            onClick={() => onChange({ zodiacRules: rules.filter((_, j) => j !== i) })}
          >
            删除
          </button>
        </p>
      ))}
    </section>
  );
}
