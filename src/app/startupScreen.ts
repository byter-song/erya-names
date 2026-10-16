interface StartupFailureActions {
  onRetry: () => void;
  onBrowse: () => void;
}
export interface StartupController {
  readonly element: HTMLElement;
  setProgress: (value: number) => void;
  exit: () => Promise<void>;
  fail: (actions: StartupFailureActions) => void;
}
/** A lightweight system-font loading screen; actual data readiness controls its duration. */
export function createStartupScreen(): StartupController {
  const screen = document.createElement("section");
  screen.className = "startup-screen";
  screen.setAttribute("role", "status");
  screen.setAttribute("aria-live", "polite");
  const center = document.createElement("div");
  center.className = "startup-screen__center";
  const mark = document.createElement("strong");
  mark.className = "startup-screen__mark";
  mark.textContent = "雅";
  const label = document.createElement("p");
  label.textContent = "展卷寻名 · 正在读取本地资料";
  const progress = document.createElement("progress");
  progress.max = 1;
  progress.value = 0;
  progress.setAttribute("aria-label", "资料载入进度");
  center.append(mark, label, progress);
  screen.append(center);
  return {
    element: screen,
    setProgress(value) {
      progress.value = Math.max(progress.value, Math.min(1, value));
    },
    async exit() {
      progress.value = 1;
    },
    fail(actions) {
      screen.classList.add("startup-screen--error");
      const card = document.createElement("div");
      card.className = "startup-screen__error-card";
      const heading = document.createElement("strong");
      heading.textContent = "起名资料暂时未能载入";
      const description = document.createElement("p");
      description.textContent =
        "已有方案仍保存在本机，数据未被修改。请重试，或打开已有方案与备份。";
      const wrap = document.createElement("div");
      wrap.className = "startup-screen__error-actions";
      for (const [action, text, handler] of [
        ["retry", "重新载入", actions.onRetry],
        ["browse", "打开已有方案与备份", actions.onBrowse],
      ] as const) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.action = action;
        button.textContent = text;
        button.addEventListener("click", handler);
        wrap.append(button);
      }
      card.append(heading, description, wrap);
      center.replaceChildren(card);
    },
  };
}
