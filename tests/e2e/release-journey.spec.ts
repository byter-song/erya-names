import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SelectedNamesExport } from "../../src/application/models/SelectedNamesExport";
import { createProject } from "./helpers";

test("runs the complete local naming release journey", async ({ page }) => {
  test.setTimeout(120_000);
  const projectId = await createProject(page);

  await page.goto(`/projects/${projectId}/config#configuration-inspiration`);
  await expect(page.getByRole("checkbox", { name: "诗词典故" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "现代组合" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "历代人物与状元灵感" })).toBeChecked();
  await page.getByRole("button", { name: "基础", exact: true }).click();
  await page.getByRole("button", { name: "添加风格" }).click();
  await page.getByRole("textbox", { name: "风格偏好 1", exact: true }).fill("清朗自然");
  await page.getByRole("button", { name: "保存配置" }).click();
  await expect(page.getByText("分析完成")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("link", { name: "进入名字长卷" }).click();
  await expect(page.getByText(/综合分/).first()).toBeVisible();

  await generateUntil(page, 21);
  expect(await readCandidateSourceTypes(page, projectId)).toEqual(
    expect.arrayContaining([
      "verified_allusion",
      "modern_combination",
      "historical_inspiration",
    ]),
  );

  await moveForward(page, "候选池", 20);
  await page.getByRole("button", { name: "候选池（20）" }).click();
  await moveForward(page, "精选池", 20);
  await expect(page.getByRole("button", { name: "精选池（20）" })).toBeVisible();

  const remainingInspirationCount = await poolCount(page, "灵感池");
  expect(remainingInspirationCount).toBeGreaterThan(0);
  await page.getByRole("button", { name: `灵感池（${remainingInspirationCount}）` }).click();
  const excludedName = await page.locator(".ils__panel.is-center h2").innerText();
  await page.getByRole("button", { name: `排除${excludedName}` }).click();
  await expect(page.getByRole("button", { name: "已排除（1）" })).toBeVisible();

  await page.getByRole("button", { name: "导出精选池" }).click();
  await expect(page.getByLabel("当前导出数量")).toContainText("20");
  const exportDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 JSON" }).click();
  const exportPath = await (await exportDownload).path();
  if (!exportPath) throw new Error("Expected a selected-names export file");
  const exported = JSON.parse(await readFile(exportPath, "utf8")) as SelectedNamesExport;
  expect(exported.mode).toBe("share");
  expect(exported.candidates).toHaveLength(20);
  expect(exported.privateData).toBeUndefined();

  await page.goto(`/projects/${projectId}/backup`);
  const backupDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 JSON 备份" }).click();
  const backup = path.resolve("tmp", `release-journey-${test.info().project.name}.json`);
  await (await backupDownload).saveAs(backup);
  await page.goto("/recovery");
  await page.getByLabel("选择备份文件").setInputFiles(backup);
  await expect(page.getByRole("region", { name: "恢复预览" })).toContainText("精选 20");
  await expect(page.getByRole("region", { name: "恢复预览" })).toContainText("排除 1");
  await page.getByRole("button", { name: "确认恢复" }).click();
  await expect(page.getByRole("status")).toContainText("恢复完成");

  await page.goto("/");
  await expect(page.getByRole("link", { name: "继续方案" })).toHaveCount(2);
});

async function generateUntil(page: Page, minimum: number) {
  let count = await poolCount(page, "灵感池");
  while (count < minimum) {
    await page.getByRole("button", { name: "续卷 · 再生成 9 个" }).click();
    await expect.poll(() => poolCount(page, "灵感池")).toBeGreaterThan(count);
    count = await poolCount(page, "灵感池");
  }
}

async function moveForward(page: Page, target: "候选池" | "精选池", count: number) {
  for (let moved = 1; moved <= count; moved += 1) {
    const name = await page.locator(".ils__panel.is-center h2").innerText();
    await page.getByRole("button", { name: `选择${name}进入下一阶段` }).click();
    await expect(page.getByRole("button", { name: `${target}（${moved}）` })).toBeVisible();
  }
}

async function poolCount(page: Page, label: "灵感池" | "候选池" | "精选池") {
  const text = await page
    .getByRole("button", { name: new RegExp(`^${label}（\\d+）$`) })
    .innerText();
  return Number(text.match(/（(\d+)）/)?.[1] ?? 0);
}

async function readCandidateSourceTypes(page: Page, projectId: string) {
  return page.evaluate(async (targetProjectId) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("erya-names-v2");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    const records = await new Promise<Array<{ projectId: string; sourceType: string }>>(
      (resolve, reject) => {
        const request = database
          .transaction("candidates", "readonly")
          .objectStore("candidates")
          .getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      },
    );
    database.close();
    return [
      ...new Set(
        records
          .filter(({ projectId }) => projectId === targetProjectId)
          .map(({ sourceType }) => sourceType),
      ),
    ];
  }, projectId);
}
