import { expect, test, type Page } from "@playwright/test";
import { createProject, chooseNames } from "./helpers";

async function chapter(page: Page, label: string) {
  await page
    .getByRole("navigation", { name: "命名长卷阶段" })
    .getByRole("button", { name: label })
    .click();
}

test("supports manual names, undo and comparison snapshots", async ({ page }) => {
  await createProject(page);
  const [selected] = await chooseNames(page, 1);
  const dialog = page.getByRole("dialog");

  await page.getByRole("button", { name: "手工添加姓名" }).click();
  await dialog.getByLabel("完整姓名").fill("宋泽谦");
  await dialog.getByLabel("来源说明").fill("家人提议");
  await dialog.getByLabel("释义", { exact: true }).fill("温润谦和");
  await dialog.getByRole("button", { name: "保存手工候选" }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByLabel("查找本卷").fill("宋泽谦");
  await expect(page.getByRole("heading", { name: "灵感池 1 个" })).toBeVisible();
  await page.getByRole("button", { name: "查看宋泽谦详情" }).click();
  await expect(dialog).toContainText("温润谦和");
  await dialog.getByRole("button", { name: "保留到基础候选" }).click();

  await chapter(page, "02 基础候选");
  for (const name of ["宋泽谦", selected!]) {
    await page.getByLabel("查找本卷").fill(name);
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    await page.getByRole("button", { name: `查看${name}详情` }).click();
    await dialog.getByRole("button", { name: "跳过民俗，加入重点候选" }).click();
    await expect(dialog).toHaveCount(0);
  }

  await page.getByRole("button", { name: "并卷比较", exact: true }).click();
  await page.getByRole("textbox", { name: "快照名称" }).fill("家庭第一轮");
  await page.getByRole("button", { name: /保存.*快照/ }).click();
  await expect(page.getByRole("status")).toHaveText("对比快照已保存");
  await page.getByRole("button", { name: /查看.*家庭第一轮/ }).click();
  await expect(dialog).toContainText("宋泽谦");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: `将${selected}加入定稿名单` }).click();
  await page.getByRole("button", { name: "撤销上一步" }).click();
  await expect(page.getByRole("button", { name: `将${selected}加入定稿名单` })).toBeEnabled();
});

test("edits constraints, enforces a fixed generation character and explains unknown time", async ({
  page,
}) => {
  await createProject(page);
  const dialog = page.getByRole("dialog");

  await page.getByRole("button", { name: "调整条件" }).click();
  await dialog.getByLabel("指定字与字辈").fill("知:1");
  await dialog.getByLabel("避字", { exact: true }).fill("远");
  await dialog.getByRole("button", { name: "保存起名条件" }).click();
  await expect(dialog.getByRole("status")).toContainText("条件已保存");
  await dialog.getByRole("button", { name: "完成并返回长卷" }).click();

  await page.getByRole("button", { name: "续卷 · 再生成 9 个" }).click();
  await page.getByLabel("查找本卷").fill("宋知");
  await expect(page.getByRole("heading", { name: /宋知/ }).first()).toBeVisible();
  const names = await page.locator(".ils__panel h2").allTextContents();
  expect(names.length).toBeGreaterThan(0);
  expect(names.every((name) => name.startsWith("宋知") && !name.includes("远"))).toBe(true);

  const name = names[0]!;
  await page
    .locator(".ils__panel")
    .filter({ has: page.getByRole("heading", { name, exact: true }) })
    .getByRole("button", { name: "保留到基础候选", exact: true })
    .click();
  await chapter(page, "02 基础候选");
  await page.getByRole("button", { name: `查看${name}详情` }).click();
  await dialog.getByRole("button", { name: "进入民俗候选", exact: true }).click();
  await chapter(page, "03 民俗候选");

  await page.getByRole("button", { name: "民俗设置", exact: true }).click();
  await dialog.getByRole("checkbox", { name: "采用传统民俗参考" }).check();
  await dialog.getByLabel("民俗出生时间", { exact: true }).fill("2024-02-10T12:00");
  await dialog.getByLabel("时辰不详，只看三柱").check();
  await dialog.getByRole("button", { name: "保存并重新评估民俗候选" }).click();
  await expect(dialog.getByRole("status")).toContainText("已更新");
  await dialog.getByRole("button", { name: "完成并返回长卷" }).click();

  await page.getByRole("button", { name: `查看${name}详情` }).click();
  await expect(dialog).toContainText("时辰不详，不补算");
});

test("keeps existing local projects accessible when the corpus asset cannot load", async ({
  page,
}) => {
  const id = await createProject(page);
  await chooseNames(page, 1);
  await page.route("**/data/names-*.json", (route) => route.abort());
  await page.reload();

  await expect(page.getByRole("button", { name: "打开已有方案与备份" })).toBeVisible();
  await page.getByRole("button", { name: "打开已有方案与备份" }).click();
  await chapter(page, "01 灵感池");
  await expect(page.getByRole("heading", { name: /灵感池 \d+ 个/ })).toBeVisible();
  await chapter(page, "02 基础候选");
  await expect(page.getByRole("heading", { name: "基础候选 1 个" })).toBeVisible();

  await page.goto(`/projects/${id}/backup`);
  await page.getByRole("button", { name: "打开已有方案与备份" }).click();
  await expect(page.getByRole("button", { name: "下载 JSON 备份" })).toBeVisible();
});
