import { useEffect, useRef, useState } from "react";
import { Button } from "../../design-system/primitives/Button";
import { Dialog } from "../../design-system/primitives/Dialog";

export function AddManualCandidateDialog({
  onAdd,
}: {
  onAdd: (input: { fullName: string; userSource: string; meaning: string }) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [userSource, setUserSource] = useState("");
  const [meaning, setMeaning] = useState("");
  const [error, setError] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const hasOpened = useRef(false);

  useEffect(() => {
    if (!open && hasOpened.current) trigger.current?.focus();
  }, [open]);

  if (!open)
    return (
      <button
        onClick={() => {
          hasOpened.current = true;
          setOpen(true);
        }}
        ref={trigger}
        type="button"
      >
        手工添加姓名
      </button>
    );

  return (
    <Dialog onClose={() => setOpen(false)} title="手工添加候选">
      <p>用户录入内容不会标记为系统已复核；应用只执行当前可验证规则。</p>
      <label className="ui-field">
        <span>完整姓名</span>
        <input
          aria-label="完整姓名"
          onChange={(event) => setFullName(event.target.value)}
          value={fullName}
        />
      </label>
      <label className="ui-field">
        <span>来源说明</span>
        <input
          aria-label="来源说明"
          onChange={(event) => setUserSource(event.target.value)}
          value={userSource}
        />
      </label>
      <label className="ui-field">
        <span>释义</span>
        <input
          aria-label="释义"
          onChange={(event) => setMeaning(event.target.value)}
          value={meaning}
        />
      </label>
      <Button
        disabled={saving || !fullName.trim() || !userSource.trim() || !meaning.trim()}
        onClick={() => {
          setError("");
          setSaving(true);
          void onAdd({
            fullName: fullName.trim(),
            userSource: userSource.trim(),
            meaning: meaning.trim(),
          })
            .then(() => setOpen(false))
            .catch((reason: unknown) =>
              setError(reason instanceof Error ? reason.message : "保存失败"),
            )
            .finally(() => setSaving(false));
        }}
        type="button"
      >
        保存手工候选
      </Button>
      <button onClick={() => setOpen(false)} type="button">
        取消
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </Dialog>
  );
}
