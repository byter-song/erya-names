import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

test(
  "meets project-open, generation and 1000-candidate filter budgets",
  { tag: "@performance" },
  async ({ page }) => {
    const generationSamples: number[] = [];
    await page.goto("/");
    await page.getByRole("button", { name: "展新卷 · 新建方案" }).first().click();
    await page.getByLabel("姓氏", { exact: true }).fill("宋");
    await page.getByRole("button", { name: "下一步", exact: true }).click();
    await page.getByRole("radio", { name: "没有", exact: true }).check();
    await page.getByRole("button", { name: "下一步", exact: true }).click();
    await page.getByRole("button", { name: "完成建档，开始选名" }).click();

    for (let sample = 0; sample < 5; sample += 1) {
      const previousCount = await candidateCount(page);
      const generationStart = performance.now();
      await page
        .getByRole("button", {
          name: sample === 0 ? "展卷 · 生成 9 个名字" : "续卷 · 再生成 9 个",
          exact: true,
        })
        .click();
      await expect
        .poll(() => candidateCount(page), { message: "generation should add candidates" })
        .toBeGreaterThan(previousCount);
      generationSamples.push(performance.now() - generationStart);
    }
    const projectId = page.url().match(/projects\/([^/]+)/)?.[1];
    expect(projectId).toBeTruthy();

    await page.evaluate(
      async ({ projectId }) => {
        const request = indexedDB.open("erya-names");
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        const transaction = database.transaction(
          ["candidates", "candidateDecisions"],
          "readwrite",
        );
        const candidates = transaction.objectStore("candidates");
        const decisions = transaction.objectStore("candidateDecisions");
        for (let index = 0; index < 1_000; index += 1) {
          const id = `perf-${index}`;
          candidates.put({
            id,
            projectId,
            batchId: null,
            normalizedFingerprint: id,
            surname: "宋",
            givenName: `测${index}`,
            fullName: `宋测${index}`,
            pinyin: [],
            sourceType: "user_input",
            summary: "性能基准候选",
            sourceIds: [],
            sourceEvidence: [],
            warnings: [],
            riskSignals: [],
            ruleResults: [],
            styleTags: [index % 2 ? "清朗自然" : "文雅书卷"],
            characterElements: [],
            characterEvidence: [],
            createdAt: new Date().toISOString(),
          });
          decisions.put({
            candidateId: id,
            projectId,
            stage: "inbox",
            updatedAt: new Date().toISOString(),
          });
        }
        await new Promise<void>((resolve, reject) => {
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
        });
        database.close();
      },
      { projectId },
    );

    const projectOpenSamples: number[] = [];
    const filterSamples: number[] = [];
    for (let sample = 0; sample < 5; sample += 1) {
      const projectOpenStart = performance.now();
      await page.goto(`/projects/${projectId}/generate`);
      await expect.poll(() => candidateCount(page)).toBeGreaterThanOrEqual(1_000);
      projectOpenSamples.push(performance.now() - projectOpenStart);
      const filterStart = performance.now();
      await page.getByLabel("查找本卷").fill("测999");
      await expect.poll(() => candidateCount(page)).toBe(1);
      filterSamples.push(performance.now() - filterStart);
      await page.getByLabel("查找本卷").clear();
      await expect.poll(() => candidateCount(page)).toBeGreaterThanOrEqual(1_000);
    }

    const metrics = {
      generationP95Ms: percentile95(generationSamples),
      projectOpenP95Ms: percentile95(projectOpenSamples),
      filterP95Ms: percentile95(filterSamples),
      samples: {
        generation: generationSamples,
        projectOpen: projectOpenSamples,
        filter: filterSamples,
      },
    };
    await mkdir("output/performance", { recursive: true });
    await writeFile(
      "output/performance/ui-performance.json",
      `${JSON.stringify(metrics, null, 2)}\n`,
    );
    expect(metrics.generationP95Ms).toBeLessThan(2_000);
    expect(metrics.projectOpenP95Ms).toBeLessThan(1_000);
    expect(metrics.filterP95Ms).toBeLessThan(100);
  },
);

test(
  "reduced-motion mode has no long tasks or material layout shifts",
  { tag: "@performance" },
  async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => {
      const metrics = { longTasks: 0, cls: 0 };
      Object.defineProperty(window, "__eryaPerformance", { value: metrics });
      new PerformanceObserver((list) => {
        metrics.longTasks += list.getEntries().length;
      }).observe({ type: "longtask", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & {
            value?: number;
            hadRecentInput?: boolean;
          };
          if (!shift.hadRecentInput) metrics.cls += shift.value ?? 0;
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto("/");
    await page.waitForTimeout(500);
    const metrics = await page.evaluate(
      () =>
        (window as Window & { __eryaPerformance: { longTasks: number; cls: number } })
          .__eryaPerformance,
    );
    expect(metrics.longTasks).toBe(0);
    expect(metrics.cls).toBeLessThan(0.1);
  },
);

function percentile95(samples: number[]): number {
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * 0.95) - 1] ?? Number.POSITIVE_INFINITY;
}

async function candidateCount(page: import("@playwright/test").Page): Promise<number> {
  const text = await page.getByRole("heading", { name: /灵感池 \d+ 个/ }).textContent();
  return Number(text?.match(/(\d+) 个/)?.[1] ?? 0);
}
