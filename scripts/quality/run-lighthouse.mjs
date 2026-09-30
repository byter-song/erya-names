import { mkdir, writeFile } from "node:fs/promises";
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";
import { spawn } from "node:child_process";

const url = process.env.LIGHTHOUSE_URL ?? "http://127.0.0.1:4173";
let preview;
if (!process.env.LIGHTHOUSE_URL) {
  preview = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", "4173"], {
    stdio: "ignore",
  });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (attempt === 59) throw new Error("Preview server did not become ready");
  }
}
const chrome = await launch({ chromeFlags: ["--headless", "--no-sandbox"] });
try {
  const result = await lighthouse(url, {
    port: chrome.port,
    output: ["json", "html"],
    logLevel: "error",
    onlyCategories: ["performance", "accessibility", "best-practices"],
  });
  if (!result) throw new Error("Lighthouse did not return a report");
  await mkdir("output/lighthouse", { recursive: true });
  await writeFile("output/lighthouse/report.json", result.report[0]);
  await writeFile("output/lighthouse/report.html", result.report[1]);
  const scores = Object.fromEntries(
    Object.entries(result.lhr.categories).map(([key, value]) => [
      key,
      Math.round((value.score ?? 0) * 100),
    ]),
  );
  await writeFile("output/lighthouse/scores.json", `${JSON.stringify(scores, null, 2)}\n`);
  if (
    (scores.performance ?? 0) < 90 ||
    (scores.accessibility ?? 0) < 90 ||
    (scores["best-practices"] ?? 0) < 90
  ) {
    throw new Error(`Lighthouse gate failed: ${JSON.stringify(scores)}`);
  }
  process.stdout.write(`${JSON.stringify(scores)}\n`);
} finally {
  await chrome.kill();
  preview?.kill("SIGTERM");
}
