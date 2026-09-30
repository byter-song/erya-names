import type { InputHTMLAttributes } from "react";

export function Field({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="ui-field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}
