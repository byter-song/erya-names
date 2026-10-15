import { expect, test } from "@playwright/test";
import { createProject } from "./helpers";

test("generates on the same page and only selected names enter the persistent shortlist", async ({
  page,
}) => {
  const id = await createProject(page);
  const name = (await page.locator(".ils__panel h2").first().textContent())!;
  await page.getByRole("button", { name: /02\s*基础候选/ }).click();
  await expect(page.getByRole("heading", { name: "基础候选 0 个" })).toBeVisible();
  await page.getByRole("button", { name: /01\s*灵感池/ }).click();
  await page
    .locator(".ils__panel")
    .filter({ hasText: name })
    .getByRole("button", { name: "保留到基础候选", exact: true })
    .click();
  await page.getByRole("button", { name: /02\s*基础候选/ }).click();
  await expect(page.getByRole("heading", { name: "基础候选 1 个" })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/projects/${id}/generate#basic$`));
  await page.reload();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await page.getByRole("button", { name: `查看${name}详情` }).click();
  await page.getByRole("button", { name: "进入民俗候选", exact: true }).click();
  await page.getByRole("button", { name: /03\s*民俗候选/ }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await page.getByRole("button", { name: `查看${name}详情` }).click();
  await expect(page.getByRole("dialog")).toContainText("逐字读懂");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: `查看${name}详情` })).toBeFocused();
});

test("shows newly generated names in the same continuous scroll", async ({ page }) => {
  await createProject(page);
  const firstBatch = await page.locator(".ils__panel h2").allTextContents();
  await page.getByRole("button", { name: "续卷 · 再生成 9 个" }).click();
  await expect.poll(async () => headingCount(page)).toBeGreaterThan(9);
  await page.locator(".ils__scroller").focus();
  await page.keyboard.press("End");
  await expect(page.locator(".ils__paging")).toContainText(/18 \/ 18/);
  const latest = await page.locator(".ils__panel.is-center h2").textContent();
  expect(firstBatch).not.toContain(latest);
  await page.keyboard.press("Home");
  await expect(page.locator(".ils__paging span")).toHaveText("1 / 18");
});

test("explains the block when family rules are still unknown", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "展新卷 · 新建方案" }).first().click();
  await page.getByLabel("姓氏", { exact: true }).fill("顾");
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await expect(page.getByRole("radio", { name: "不确定", exact: true })).toBeChecked();
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await page.getByRole("button", { name: "完成建档，开始选名" }).click();
  await page.getByRole("button", { name: "展卷 · 生成 9 个名字" }).click();
  const name = (await page.locator(".ils__panel h2").first().textContent())!;
  await page
    .locator(".ils__panel")
    .filter({ hasText: name })
    .getByRole("button", { name: "保留到基础候选", exact: true })
    .click();
  await page.getByRole("button", { name: /02\s*基础候选/ }).click();
  await page.getByRole("button", { name: `查看${name}详情` }).click();
  await expect(page.getByRole("button", { name: "进入民俗候选", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "跳过民俗，加入重点候选" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "请先核对是否有必须遵守的字辈或避讳" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /04\s*重点候选/ }).click();
  await expect(page.getByRole("heading", { name: "重点候选暂时锁定" })).toBeVisible();
  await page.getByRole("button", { name: "核对家庭规则" }).click();
  await expect(page).toHaveURL(/\/generate#conditions$/);
});

async function headingCount(page: import("@playwright/test").Page): Promise<number> {
  const text = await page.getByRole("heading", { name: /灵感池 \d+ 个/ }).textContent();
  return Number(text?.match(/(\d+) 个/)?.[1] ?? 0);
}
