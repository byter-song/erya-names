import { expect, test } from "@playwright/test";

test("opens the production project center and enters onboarding", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "尔雅长卷" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "命名长卷阶段" })).toBeVisible();
  await page.getByRole("button", { name: "展新卷 · 新建方案" }).first().click();
  await expect(page).toHaveURL(/\/projects\/new\/basic$/);
  await expect(page.getByRole("heading", { name: "创建起名方案" })).toBeVisible();
});
