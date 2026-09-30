import { expect, test } from "@playwright/test";

test("opens the production project center and enters onboarding", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "开始第一个起名方案" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "方案工作区" })).toBeVisible();
  await page.getByRole("button", { name: "新建起名方案" }).click();
  await expect(page).toHaveURL(/\/projects\/new\/basic$/);
  await expect(page.getByRole("heading", { name: "创建起名方案" })).toBeVisible();
});
