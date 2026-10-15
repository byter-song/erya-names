import { useState } from "react";
import type { NamingProfile } from "../../domain/project/profile";
import { activeRuntimeBundle } from "../../data/activeRuntimeBundle";
type Sources = NonNullable<NamingProfile["inspirationSources"]>;
export function InspirationSettings({
  profile,
  onSave,
}: {
  profile: NamingProfile;
  onSave: (sources: Sources) => Promise<void>;
}) {
  const [sources, setSources] = useState<Sources>(
    profile.inspirationSources ?? ["poetry", "modern"],
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  return (
    <section>
      <p>选择下一卷的灵感。已经生成的名字和证据会保留。</p>
      <fieldset>
        <legend>生成来源（至少一项）</legend>
        {(
          [
            ["poetry", "诗词典故"],
            ["modern", "现代风格"],
            ["historical", "状元用名灵感"],
          ] as const
        ).map(([key, label]) => (
          <label className="inline-choice" key={key}>
            <input
              type="checkbox"
              checked={sources.includes(key)}
              onChange={(e) => {
                setSources(
                  e.target.checked ? [...sources, key] : sources.filter((s) => s !== key),
                );
                setMessage("");
              }}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <p>
        当前状元素材{" "}
        {activeRuntimeBundle.personUsages.filter((p) => p.identityType === "zhuangyuan").length}{" "}
        条，集中于清代，尚非历代全集。仅取已收录字卡中的名字用字，与现代组合相接；显示人物来源、原名与取字关系。人物身份不会增加匹配分。
      </p>
      <button
        disabled={busy || !sources.length}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await onSave(sources);
            setMessage("灵感来源已保存，下一卷生效。");
          } catch (e) {
            setError(e instanceof Error ? e.message : "保存失败");
          } finally {
            setBusy(false);
          }
        }}
      >
        保存灵感来源
      </button>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
