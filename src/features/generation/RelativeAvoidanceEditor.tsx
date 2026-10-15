import { useState } from "react";
import { namingProfileSchema, type NamingProfile } from "../../domain/project/profile";

type Rule = NonNullable<NamingProfile["relativeAvoidances"]>[number];
const emptyRule: Rule = { fullName: "", givenName: "", mode: "whole-name", pinyin: [] };
const labels = {
  "whole-name": "避整名",
  "same-character": "避名中同字",
  "same-sound": "避名中同音（不分声调）",
};

export function RelativeAvoidanceEditor({
  profile,
  onChange,
}: {
  profile: NamingProfile;
  onChange: (rules: Rule[]) => void;
}) {
  const [draft, setDraft] = useState<Rule>(emptyRule);
  const [pinyin, setPinyin] = useState("");
  const [error, setError] = useState("");
  const rules = profile.relativeAvoidances ?? [];
  return (
    <section className="wide-field" aria-label="逐亲属避讳">
      <h3>逐亲属设置避讳</h3>
      <p>
        只比较名，不把姓氏算入同字或同音。普通话同音按候选显示读音比较、不分声调；多音字和方言仍需家人试读。
      </p>
      {rules.map((rule, index) => (
        <p key={index}>
          {rule.fullName} · {labels[rule.mode]}
          {rule.givenName ? ` · 名：${rule.givenName}` : ""}
          {rule.mode === "same-sound" ? ` · ${rule.pinyin.join(" ")}` : ""}{" "}
          <button
            type="button"
            aria-label={`删除${rule.fullName}的避讳`}
            onClick={() => onChange(rules.filter((_, i) => i !== index))}
          >
            删除
          </button>
        </p>
      ))}
      <details>
        <summary>添加亲属避讳</summary>
        <div className="studio-fields">
          <label>
            亲属完整姓名
            <input
              maxLength={20}
              value={draft.fullName}
              onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
            />
          </label>
          <label>
            避讳范围
            <select
              value={draft.mode}
              onChange={(e) => setDraft({ ...draft, mode: e.target.value as Rule["mode"] })}
            >
              {Object.entries(labels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {draft.mode !== "whole-name" && (
            <label>
              亲属的名（不含姓）
              <input
                maxLength={4}
                value={draft.givenName}
                placeholder="例如亲属林清和，填写清和"
                onChange={(e) => setDraft({ ...draft, givenName: e.target.value })}
              />
            </label>
          )}
          {draft.mode === "same-sound" && (
            <label>
              亲属名的普通话读音
              <input
                value={pinyin}
                placeholder="例如 qīng hé 或 qing he"
                maxLength={80}
                onChange={(e) => setPinyin(e.target.value)}
              />
            </label>
          )}
        </div>
        <button
          type="button"
          disabled={rules.length >= 30}
          onClick={() => {
            const next = { ...draft, pinyin: pinyin.trim().split(/\s+/u).filter(Boolean) };
            const parsed = namingProfileSchema.safeParse({
              ...profile,
              constraintKnowledge: "present",
              relativeAvoidances: [...rules, next],
            });
            if (!parsed.success) {
              setError(parsed.error.issues.map((issue) => issue.message).join("；"));
              return;
            }
            onChange(parsed.data.relativeAvoidances ?? []);
            setDraft(emptyRule);
            setPinyin("");
            setError("");
          }}
        >
          加入避讳草稿
        </button>
        <p>加入后请点击下方「保存起名条件」，才会用于生成和已有名字的资格检查。</p>
        {error && <p role="alert">{error}</p>}
      </details>
    </section>
  );
}
