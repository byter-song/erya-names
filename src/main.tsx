import "./design-system/global.css";
import { initializeRuntimeBundle } from "./data/activeRuntimeBundle";
import { createStartupScreen, showStartupFailure } from "./app/startupScreen";
import { applyTheme, getInitialTheme } from "./design-system/theme";
const root = document.getElementById("root");
if (!root) throw new Error("Missing #root application mount point");
applyTheme(getInitialTheme());
async function start(root: HTMLElement) {
  const openingDelay = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? Promise.resolve()
    : new Promise<void>((resolve) => window.setTimeout(resolve, 650));
  const startupScreen = createStartupScreen();
  root.replaceChildren(startupScreen);
  try {
    const response = await fetch(__RUNTIME_BUNDLE_URL__, {
      cache: "default",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("corpus-unavailable");
    initializeRuntimeBundle(await response.json());
    const [{ bootstrap }] = await Promise.all([import("./app/bootstrap"), openingDelay]);
    await bootstrap(root);
  } catch {
    showStartupFailure(startupScreen, {
      onRetry: () => void start(root),
      onBrowse: () => {
        initializeRuntimeBundle({
          manifest: {
            version: "unavailable",
            status: "personal",
            builtAt: "2026-09-27T00:00:00.000Z",
            contentHash: "unavailable",
          },
          characters: [],
          allusions: [],
        });
        void import("./app/bootstrap")
          .then(({ bootstrap }) => bootstrap(root))
          .catch(() => {
            const copy = startupScreen.querySelector<HTMLElement>(".startup-screen__copy");
            if (copy)
              copy.textContent =
                "应用文件也暂时无法读取，请恢复本地服务后重试。已有方案未被修改。";
          });
      },
    });
  }
}
void start(root);
