import "./design-system/global.css";
import "./app/startup-screen.css";
import { initializeRuntimeBundle } from "./data/activeRuntimeBundle";
import { createStartupScreen } from "./app/startupScreen";
import { applyTheme } from "./design-system/theme";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root application mount point");
applyTheme();

async function start(root: HTMLElement) {
  const startup = createStartupScreen();
  root.replaceChildren(startup.element);
  const bootstrapPromise = import("./app/bootstrap");

  // 路由代码和本地资料并行读取；只有资料就绪后才挂载应用。
  const proceed = async () => {
    await startup.exit();
    const { bootstrap } = await bootstrapPromise;
    await bootstrap(root);
  };

  try {
    const response = await fetch(__RUNTIME_BUNDLE_URL__, {
      cache: "default",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("corpus-unavailable");

    if (response.body) {
      const total = Number(response.headers.get("content-length")) || 0;
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.length;
          if (total) startup.setProgress(received / total);
        }
      }
      const body = new Uint8Array(received);
      let offset = 0;
      for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.length;
      }
      initializeRuntimeBundle(JSON.parse(new TextDecoder().decode(body)));
    } else {
      initializeRuntimeBundle(await response.json());
    }
    startup.setProgress(1);
    await proceed();
  } catch {
    startup.fail({
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
        void proceed();
      },
    });
  }
}

void start(root);
