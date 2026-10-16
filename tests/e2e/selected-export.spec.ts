import { expect, test, type Download, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { SelectedNamesExport } from "../../src/application/models/SelectedNamesExport";
import { createProject } from "./helpers";

test("selects twenty names and exports privacy-safe share and confirmed personal files", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const projectId = await createProject(page);

  await configurePrivateData(page);
  await generateUntil(page, 20);
  await moveFirstNameForward(page, "inspiration", "candidate", 20);
  await page.getByRole("button", { name: "候选池（20）" }).click();
  await expect(page.getByRole("heading", { name: "候选池 20 个" })).toBeVisible();
  await moveFirstNameForward(page, "candidate", "selected", 20);
  await expect(page.getByRole("button", { name: "精选池（20）" })).toBeVisible();

  await page.getByRole("button", { name: "导出精选池" }).click();
  await expect(page).toHaveURL(`/projects/${projectId}/export`);
  await expect(page.getByRole("heading", { name: "精选导出中心" })).toBeVisible();
  await expect(page.getByLabel("当前导出数量")).toContainText("20");
  await expect(page.getByText("共 20 个精选")).toBeVisible();
  await expect(page.getByRole("heading", { name: "将隐藏" })).toBeVisible();
  await expect(page.getByText("出生日期与时辰")).toBeVisible();
  await expect(page.getByText("四柱信息")).toBeVisible();
  await expect(page.getByText("亲属姓名与避讳明细")).toBeVisible();
  await expect(page.getByText("生肖明细", { exact: true })).toBeVisible();

  const share = await downloadJson(page);
  expect(share).toMatchObject({
    schema: "erya-selected-names-export",
    schemaVersion: 1,
    mode: "share",
    format: "json",
    visibility: {
      birthData: false,
      fourPillars: false,
      relatives: false,
      zodiacDetails: false,
      notes: false,
    },
  });
  expect(share.candidates).toHaveLength(20);
  expect(share.privateData).toBeUndefined();
  expect(JSON.stringify(share)).not.toContain("仅供家庭私藏的方言备注");
  expect(JSON.stringify(share)).not.toContain("宋密亲");
  expect(JSON.stringify(share)).not.toContain("2026-02-03T08:15");
  expect(share.candidates.every((candidate) => candidate.evaluation?.note === undefined)).toBe(
    true,
  );
  await expect(page.getByLabel("精选导出文档")).toContainText("ERYA · 分享版");
  await expect(page.getByLabel("精选导出文档")).toContainText("精选 20 个");

  await page.getByRole("radio", { name: /完整个人版/ }).check();
  await expect(page.getByRole("heading", { name: "完整范围" })).toBeVisible();
  await expect(page.getByText("已选择完整个人版，敏感字段会进入文件。")).toBeVisible();
  await page.getByRole("button", { name: "下载 JSON" }).click();
  await expect(page.getByRole("alert")).toContainText("请先勾选确认");

  await page.getByRole("checkbox", { name: /我确认此文件包含出生、四柱、亲属/ }).check();
  const personal = await downloadJson(page);
  expect(personal).toMatchObject({
    schema: "erya-selected-names-export",
    schemaVersion: 1,
    mode: "personal",
    format: "json",
    visibility: {
      birthData: true,
      fourPillars: true,
      relatives: true,
      zodiacDetails: true,
      notes: true,
    },
  });
  expect(personal.candidates).toHaveLength(20);
  expect(personal.privateData).toMatchObject({
    birth: { localDateTime: "2026-02-03T08:15", timeKnown: true },
    relatives: { names: ["宋密亲"], avoidances: [] },
    notes: { dialect: "仅供家庭私藏的方言备注" },
  });
  expect(personal.privateData?.fourPillars).toHaveLength(4);
  await expect(page.getByLabel("精选导出文档")).toContainText("ERYA · 完整个人版");
  await expect(page.getByLabel("精选导出文档")).toContainText("精选 20 个");
});

async function configurePrivateData(page: Page) {
  await page.getByRole("button", { name: "民俗与起名配置", exact: true }).click();
  await expect(page.getByText("统一配置 · 一页完成")).toBeVisible();
  await page.getByLabel("家庭方言与叫名备注（可选）").fill("仅供家庭私藏的方言备注");
  await page.getByRole("button", { name: "添加亲属姓名" }).click();
  await page.locator("label", { hasText: "亲属姓名 1" }).locator("input").fill("宋密亲");
  await page.getByLabel("出生时辰已知").check();
  await page.getByLabel(/公历出生日期与时间/).fill("2026-02-03T08:15");
  await page.getByRole("button", { name: "保存配置" }).click();
  await expect(page.getByRole("status").filter({ hasText: "配置已保存" })).toBeVisible();
  await page.getByRole("link", { name: "进入名字长卷" }).click();
  await expect(page.getByRole("heading", { name: /灵感池 \d+ 个/ })).toBeVisible();
}

async function generateUntil(page: Page, minimum: number) {
  let count = await poolCount(page, "灵感池");
  while (count < minimum) {
    await page.getByRole("button", { name: "续卷 · 再生成 9 个" }).click();
    await expect
      .poll(() => poolCount(page, "灵感池"), { message: "等待下一批名字写入灵感池" })
      .toBeGreaterThan(count);
    count = await poolCount(page, "灵感池");
  }
}

async function moveFirstNameForward(
  page: Page,
  from: "inspiration" | "candidate",
  to: "candidate" | "selected",
  count: number,
) {
  const targetLabel = to === "candidate" ? "候选池" : "精选池";
  for (let moved = 1; moved <= count; moved += 1) {
    const name = await page.locator(".ils__panel.is-center h2").innerText();
    await page.getByRole("button", { name: `选择${name}进入下一阶段` }).click();
    await expect(
      page.getByRole("button", { name: `${targetLabel}（${moved}）` }),
    ).toBeVisible();
  }
  await expect(page.getByRole("button", { name: `${targetLabel}（${count}）` })).toBeVisible();
  if (from === "candidate")
    await expect(page.getByRole("heading", { name: "候选池 0 个" })).toBeVisible();
}

async function poolCount(page: Page, label: "灵感池" | "候选池" | "精选池") {
  const text = await page
    .getByRole("button", { name: new RegExp(`^${label}（\\d+）$`) })
    .innerText();
  return Number(text.match(/（(\d+)）/)?.[1] ?? 0);
}

async function downloadJson(page: Page): Promise<SelectedNamesExport> {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 JSON" }).click();
  return readDownloadedJson(await pending);
}

async function readDownloadedJson(download: Download): Promise<SelectedNamesExport> {
  const path = await download.path();
  if (!path) throw new Error("Expected Playwright to persist the downloaded JSON");
  return JSON.parse(await readFile(path, "utf8")) as SelectedNamesExport;
}
