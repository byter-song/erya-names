import { useState, useEffect, useRef } from "react";
import type { NamingProfile } from "../../domain/project/profile";
import { Button } from "../../design-system/primitives/Button";
import { elementLabels, type FiveElement } from "../../domain/folklore/calendarAdapter";
import { FolklorePanel } from "../insights/FolklorePanel";
const split = (value: string) => [...new Set(value.split(/[，,、\s]+/u).filter(Boolean))];
export function ProfileEditor({
  profile,
  onSave,
}: {
  profile: NamingProfile;
  onSave: (profile: NamingProfile) => Promise<void>;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const open = () => {
      if (location.hash === "#conditions" && detailsRef.current) detailsRef.current.open = true;
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
  const [draft, setDraft] = useState(profile);
  const [required, setRequired] = useState(
    profile.requiredCharacters
      .map((x) => (x.position === "any" ? x.char : `${x.char}:${x.position}`))
      .join("、"),
  );
  const [avoid, setAvoid] = useState(profile.avoidCharacters.join("、"));
  const [relatives, setRelatives] = useState(profile.relativeNames.join("、"));
  const [forbidden, setForbidden] = useState(profile.forbiddenCombinations.join("、"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const field = <K extends keyof NamingProfile>(key: K, value: NamingProfile[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };
  const folklore = (patch: Partial<NamingProfile["folklore"]>) =>
    field("folklore", { ...draft.folklore, ...patch });
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const requirements = split(required).map((value) => {
        const match = value.match(/^(\p{Script=Han})(?:[:：]([12]))?$/u);
        if (!match) throw new Error("指定字请填写单字，固定位置用“知:1”，多个字用顿号分隔");
        return {
          char: match[1]!,
          position: match[2] ? (Number(match[2]) as 1 | 2) : ("any" as const),
        };
      });
      await onSave({
        ...draft,
        requiredCharacters: requirements,
        avoidCharacters: [...new Set(split(avoid).flatMap((value) => [...value]))],
        relativeNames: split(relatives),
        forbiddenCombinations: split(forbidden),
      });
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存失败，请重试");
    } finally {
      setBusy(false);
    }
  };
  return (
    <details ref={detailsRef} className="profile-editor paper-card" id="conditions">
      <summary>
        起名条件与民俗设置 <span>姓氏 · 字辈 · 避讳 · 风格 · 出生信息</span>
      </summary>
      <p>保存后用于下一批生成；已收入的名字和历史评分保留，方便比较不同方案。</p>
      <div className="studio-fields">
        <label>
          姓氏
          <input
            value={draft.surname}
            onChange={(e) => field("surname", e.target.value)}
            maxLength={4}
          />
        </label>
        <label>
          姓氏读音（可选）
          <input
            value={draft.surnamePinyin ?? ""}
            placeholder="例如 shàn；多字用空格分隔"
            onChange={(e) => field("surnamePinyin", e.target.value)}
          />
        </label>
        <label>
          姓氏结构
          <select
            value={draft.surnameType}
            onChange={(e) =>
              field("surnameType", e.target.value as NamingProfile["surnameType"])
            }
          >
            <option value="single">单姓</option>
            <option value="compound">传统复姓</option>
            <option value="combined_parental">父母组合姓（需核对登记）</option>
          </select>
        </label>
        <label>
          名字长度
          <select
            value={draft.givenNameLength}
            onChange={(e) => field("givenNameLength", Number(e.target.value) as 1 | 2)}
          >
            <option value={1}>一字名</option>
            <option value={2}>二字名</option>
          </select>
        </label>
        <label>
          指定字与字辈
          <input
            value={required}
            onChange={(e) => setRequired(e.target.value)}
            placeholder="例如 知:1（名的第一位）"
          />
        </label>
        <label>
          避字
          <input
            value={avoid}
            onChange={(e) => setAvoid(e.target.value)}
            placeholder="用顿号分隔"
          />
        </label>
        <label>
          亲属姓名
          <input
            value={relatives}
            onChange={(e) => setRelatives(e.target.value)}
            placeholder="避免与亲属完整姓名相同"
          />
        </label>
        <label>
          禁用名字组合
          <input
            value={forbidden}
            onChange={(e) => setForbidden(e.target.value)}
            placeholder="例如 明明、子轩"
          />
        </label>
        <label>
          性别表达
          <select
            value={draft.genderExpression}
            onChange={(e) =>
              field("genderExpression", e.target.value as NamingProfile["genderExpression"])
            }
          >
            <option value="unrestricted">不限</option>
            <option value="neutral">中性</option>
            <option value="masculine">偏阳刚</option>
            <option value="feminine">偏柔美</option>
          </select>
        </label>
        <label>
          书写偏好
          <select
            value={draft.writingComplexity}
            onChange={(e) =>
              field("writingComplexity", e.target.value as NamingProfile["writingComplexity"])
            }
          >
            <option value="simple">尽量简洁</option>
            <option value="balanced">笔画均衡</option>
            <option value="unrestricted">不限</option>
          </select>
        </label>
        <label className="wide-field">
          家庭方言与叫名备注
          <textarea
            value={draft.dialectNotes ?? ""}
            onChange={(e) => field("dialectNotes", e.target.value)}
            maxLength={500}
            placeholder="记录需要家人确认的方言读音与昵称"
          />
        </label>
        <fieldset className="wide-field">
          <legend>风格偏好</legend>
          {["清朗自然", "文雅书卷", "沉稳端正", "中性现代", "温婉灵秀"].map((tag) => (
            <label className="inline-choice" key={tag}>
              <input
                type="checkbox"
                checked={draft.styleTags.includes(tag)}
                onChange={(e) =>
                  field(
                    "styleTags",
                    e.target.checked
                      ? [...draft.styleTags, tag]
                      : draft.styleTags.filter((x) => x !== tag),
                  )
                }
              />
              {tag}
            </label>
          ))}
        </fieldset>
        <label className="inline-choice">
          <input
            type="checkbox"
            checked={draft.pinyinFriendly}
            onChange={(e) => field("pinyinFriendly", e.target.checked)}
          />
          重视拼音辨识
        </label>
        <label className="inline-choice">
          <input
            type="checkbox"
            checked={draft.folklore.enabled}
            onChange={(e) => folklore({ enabled: e.target.checked })}
          />
          开启传统民俗参考
        </label>
        {draft.folklore.enabled ? (
          <>
            <label>
              出生日期{draft.folklore.timeKnown !== false ? "与时间" : ""}
              <input
                aria-label="民俗出生时间"
                type={draft.folklore.timeKnown === false ? "date" : "datetime-local"}
                value={draft.folklore.birthLocalDateTime ?? ""}
                onChange={(e) =>
                  folklore({ birthLocalDateTime: e.target.value, timeZone: "Asia/Shanghai" })
                }
              />
            </label>
            <label>
              四柱换日口径
              <select
                value={draft.folklore.dayBoundary ?? "midnight"}
                onChange={(e) => folklore({ dayBoundary: e.target.value as "midnight" | "zi" })}
              >
                <option value="midnight">00:00 午夜换日</option>
                <option value="zi">23:00 晚子时换日</option>
              </select>
            </label>
            <label className="inline-choice">
              <input
                type="checkbox"
                checked={draft.folklore.timeKnown === false}
                onChange={(e) =>
                  folklore({
                    timeKnown: !e.target.checked,
                    birthLocalDateTime: e.target.checked
                      ? (draft.folklore.birthLocalDateTime ?? "").slice(0, 10)
                      : "",
                  })
                }
              />
              时辰不详，只看三柱
            </label>
            <fieldset className="wide-field">
              <legend>家人指定的五行意象（不是系统推断的喜用神）</legend>
              {(Object.entries(elementLabels) as [FiveElement, string][]).map(
                ([key, label]) => (
                  <label className="inline-choice" key={key}>
                    <input
                      type="checkbox"
                      checked={draft.folklore.usefulElements.includes(key)}
                      onChange={(e) =>
                        folklore({
                          usefulElements: e.target.checked
                            ? [...draft.folklore.usefulElements, key]
                            : draft.folklore.usefulElements.filter((x) => x !== key),
                        })
                      }
                    />
                    {label}
                  </label>
                ),
              )}
            </fieldset>
            <label className="inline-choice">
              <input
                type="checkbox"
                checked={draft.folklore.includeInRanking}
                onChange={(e) => folklore({ includeInRanking: e.target.checked })}
              />
              让指定五行参与软排序
            </label>
          </>
        ) : null}
      </div>
      <div className="studio-actions">
        <Button disabled={busy} onClick={() => void save()} type="button">
          {busy ? "正在保存…" : "保存起名条件"}
        </Button>
        {saved ? <span role="status">条件已保存，下一批将使用新条件。</span> : null}
      </div>
      {error ? (
        <p role="alert" className="onboarding__error">
          {error}
        </p>
      ) : null}
      <FolklorePanel profile={draft} />
    </details>
  );
}
