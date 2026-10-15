import { ZodiacRuleEditor } from "./ZodiacRuleEditor";
import { lazy, Suspense, useEffect, useState } from "react";
import { Button } from "../../design-system/primitives/Button";
import { elementLabels, type FiveElement } from "../../domain/folklore/fiveElements";
import type { NamingProfile } from "../../domain/project/profile";

const FolklorePanel = lazy(() =>
  import("../insights/FolklorePanel").then((module) => ({ default: module.FolklorePanel })),
);

export function FolkloreReviewSettings({
  profile,
  candidateCount,
  onSave,
}: {
  profile: NamingProfile;
  candidateCount: number;
  onSave: (folklore: NamingProfile["folklore"]) => Promise<void>;
}) {
  const [draft, setDraft] = useState(() => normalize(profile.folklore));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setDraft(normalize(profile.folklore)), [profile.folklore]);

  const patch = (value: Partial<NamingProfile["folklore"]>) => {
    setDraft((current) => ({ ...current, ...value }));
    setSaved(false);
  };
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await onSave({ ...draft, timeZone: "Asia/Shanghai" });
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "民俗设置保存失败，请重试");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="folklore-review-settings paper-card" aria-label="民俗参考设置">
      <div className="studio-section-heading">
        <div>
          <h3>民俗参考设置</h3>
          <p>
            只重新评估当前民俗候选，不改变灵感池和基础候选的系统匹配分。当前有 {candidateCount}
            个名字等待民俗参考。
          </p>
        </div>
        <span className="ui-status">传统民俗参考，非科学结论</span>
      </div>
      <label className="inline-choice">
        <input
          type="checkbox"
          checked={draft.enabled}
          onChange={(e) => patch({ enabled: e.target.checked })}
        />
        采用传统民俗参考
      </label>
      <div className="studio-fields">
        <label>
          出生日期{draft.timeKnown === false ? "" : "与时间"}（可选）
          <input
            aria-label="民俗出生时间"
            type={draft.timeKnown === false ? "date" : "datetime-local"}
            value={draft.birthLocalDateTime ?? ""}
            onChange={(event) => patch({ birthLocalDateTime: event.target.value })}
          />
        </label>
        <label>
          四柱换日口径
          <select
            aria-label="四柱换日口径"
            value={draft.dayBoundary ?? "midnight"}
            onChange={(event) =>
              patch({ dayBoundary: event.target.value as "midnight" | "zi" })
            }
          >
            <option value="midnight">00:00 午夜换日</option>
            <option value="zi">23:00 晚子时换日</option>
          </select>
        </label>
        <label className="inline-choice">
          <input
            checked={draft.timeKnown === false}
            onChange={(event) =>
              patch({
                timeKnown: !event.target.checked,
                birthLocalDateTime: event.target.checked
                  ? (draft.birthLocalDateTime ?? "").slice(0, 10)
                  : "",
              })
            }
            type="checkbox"
          />
          时辰不详，只看三柱
        </label>
        <fieldset className="wide-field">
          <legend>家人指定的五行意象（不是系统推断的喜用神）</legend>
          {(Object.entries(elementLabels) as [FiveElement, string][]).map(([key, label]) => (
            <label className="inline-choice" key={key}>
              <input
                checked={draft.usefulElements.includes(key)}
                onChange={(event) =>
                  patch({
                    usefulElements: event.target.checked
                      ? [...draft.usefulElements, key]
                      : draft.usefulElements.filter((item) => item !== key),
                  })
                }
                type="checkbox"
              />
              {label}
            </label>
          ))}
        </fieldset>
        <label className="inline-choice wide-field">
          <input
            checked={draft.includeInRanking}
            onChange={(event) => patch({ includeInRanking: event.target.checked })}
            type="checkbox"
          />
          用指定五行意象排序当前民俗候选
        </label>
        <ZodiacRuleEditor folklore={draft} onChange={patch} />
      </div>
      <div className="studio-actions">
        <Button disabled={busy} onClick={() => void save()} type="button">
          {busy ? "正在重新评估…" : "保存并重新评估民俗候选"}
        </Button>
        {saved ? <span role="status">民俗设置和当前候选结果已更新。</span> : null}
      </div>
      {error ? (
        <p className="onboarding__error" role="alert">
          {error}
        </p>
      ) : null}
      {draft.birthLocalDateTime ? (
        <Suspense fallback={<p role="status">正在载入民俗参考…</p>}>
          <FolklorePanel profile={{ folklore: { ...draft, enabled: true } }} />
        </Suspense>
      ) : (
        <p className="insight-note">
          出生信息可以留空；仍可按字义五行文化意象查看名字，不会自动判断喜用神。
        </p>
      )}
    </section>
  );
}

function normalize(folklore: NamingProfile["folklore"]): NamingProfile["folklore"] {
  return {
    ...folklore,
    enabled: folklore.enabled,
    dayBoundary: folklore.dayBoundary ?? "midnight",
    timeKnown: folklore.timeKnown ?? true,
    timeZone: "Asia/Shanghai",
  };
}
