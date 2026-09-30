interface StartupFailureActions {
  onRetry: () => void;
  onBrowse: () => void;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

export function createStartupScreen(): HTMLElement {
  const screen = element("section", "startup-screen");
  screen.setAttribute("role", "status");
  screen.setAttribute("aria-live", "polite");

  const stage = element("div", "startup-screen__stage");
  const brush = element("span", "startup-screen__brush");
  brush.setAttribute("aria-hidden", "true");
  const mark = element("span", "startup-screen__mark brush-type", "雅");
  const copy = element("div", "startup-screen__copy");
  copy.append(
    element("strong", "brush-type", "展卷寻名"),
    element("span", "", "挥毫一笔 · 展卷见名"),
    element("i", "startup-screen__progress"),
  );
  stage.append(brush, mark, copy);
  screen.append(stage);
  return screen;
}

export function showStartupFailure(
  screen: HTMLElement,
  { onRetry, onBrowse }: StartupFailureActions,
): void {
  screen.classList.add("startup-screen--error");
  const copy = screen.querySelector<HTMLElement>(".startup-screen__copy");
  if (!copy) return;
  copy.replaceChildren();
  copy.append(
    element("strong", "", "起名资料暂时未能载入"),
    element("span", "", "已有方案仍保存在本机，请确认本地服务正常后重试。"),
  );
  const actions = element("div", "startup-screen__actions");
  const retry = element("button", "", "重新载入");
  retry.dataset.action = "retry";
  retry.type = "button";
  retry.addEventListener("click", onRetry);
  const browse = element("button", "", "打开已有方案与备份");
  browse.dataset.action = "browse";
  browse.type = "button";
  browse.addEventListener("click", onBrowse);
  actions.append(retry, browse);
  copy.append(actions);
}
