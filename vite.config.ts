import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";
import { loadSelectedRuntimeBundle } from "./scripts/data/runtimeBundleSelection.ts";
const corpus = JSON.stringify(loadSelectedRuntimeBundle());
const corpusFile = `data/names-${createHash("sha256").update(corpus).digest("hex").slice(0, 12)}.json`;
function corpusAsset(): Plugin {
  return {
    name: "erya-local-corpus",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0] !== `/${corpusFile}`) return next();
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(corpus);
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: corpusFile, source: corpus });
    },
  };
}
export default defineConfig({
  plugins: [react(), corpusAsset()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? "0.0.0"),
    __RUNTIME_BUNDLE_URL__: JSON.stringify(`/${corpusFile}`),
  },
  server: { host: "127.0.0.1" },
});
