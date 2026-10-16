import { expect, type Page } from "@playwright/test";
export async function createProject(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "展新卷 · 新建方案" }).first().click();
  await page.getByLabel("姓氏", { exact: true }).fill("宋");
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await page.getByRole("radio", { name: "没有", exact: true }).check();
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await page.getByRole("button", { name: "完成建档，开始选名" }).click();
  await expect(page.getByText("统一配置 · 一页完成")).toBeVisible();
  await page.getByRole("link", { name: "进入名字长卷" }).click();
  const generate = page.getByRole("button", { name: "展卷 · 生成 9 个名字" });
  await expect(generate).toBeVisible();
  await generate.click();
  await expect(page.getByRole("heading", { name: "灵感池 9 个" })).toBeVisible();
  return page.url().match(/projects\/([^/]+)/)![1]!;
}
export async function chooseNames(page: Page, count = 3) {
  const names = (await page.locator(".ils__panel h2").allTextContents()).slice(0, count);
  for (const name of names) {
    await page.getByRole("button", { name: `选择${name}进入下一阶段` }).click();
  }
  await page.getByRole("button", { name: `候选池（${count}）` }).click();
  await expect(page.getByRole("heading", { name: `候选池 ${count} 个` })).toBeVisible();
  return names;
}
