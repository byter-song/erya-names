import { useLayoutEffect, useState } from "react";
import { applyTheme, getInitialTheme, persistTheme, type Theme } from "./theme";
import "./theme-toggle.css";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useLayoutEffect(() => applyTheme(theme), [theme]);

  const dark = theme === "dark";
  const toggle = () => {
    const next: Theme = dark ? "light" : "dark";
    applyTheme(next);
    persistTheme(next);
    setTheme(next);
  };

  return (
    <button
      aria-label={dark ? "切换为亮色主题" : "切换为暗色主题"}
      aria-pressed={dark}
      className="theme-toggle"
      onClick={toggle}
      title={dark ? "切换为亮色主题" : "切换为暗色主题"}
      type="button"
    >
      <svg aria-hidden="true" className="theme-toggle__sun" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
      </svg>
      <svg aria-hidden="true" className="theme-toggle__moon" viewBox="0 0 24 24">
        <path d="M20 15.1A8.2 8.2 0 0 1 8.9 4a8.3 8.3 0 1 0 11.1 11.1Z" />
      </svg>
    </button>
  );
}
