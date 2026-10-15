import { expect, test } from "@playwright/test";
import { chooseNames, createProject } from "./helpers";

test("keeps the active journey step visible without a native scrollbar", async ({ page }) => {
  await page.goto("/recovery");

  const active = page.locator('.ink-shell__chip[aria-current="page"]');
  await expect(active).toContainText("备份与导出");
  await expect
    .poll(async () => {
      const box = await active.boundingBox();
      return box ? box.x >= 0 && box.x + box.width <= page.viewportSize()!.width : false;
    })
    .toBe(true);
  await expect(page.locator(".ink-shell__chips")).toHaveCSS("scrollbar-width", "none");
});

test("uses the route as the source of truth for onboarding steps", async ({ page }) => {
  await page.goto("/projects/new/preferences");

  await expect(page.getByLabel("第 3 步，共 3 步")).toBeVisible();
  await expect(page.getByLabel("性别表达")).toBeVisible();
  await page.getByRole("button", { name: "上一步" }).click();
  await expect(page).toHaveURL(/\/projects\/new\/constraints$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/projects\/new\/preferences$/);
  await expect(page.getByLabel("第 3 步，共 3 步")).toBeVisible();
});

test("compares the same attributes across three important names on mobile", async ({
  page,
}) => {
  await createProject(page);
  const names = await chooseNames(page, 3);
  const dialog = page.getByRole("dialog");
  for (const name of names) {
    await page.getByRole("button", { name: `查看${name}详情` }).click();
    await dialog.getByRole("button", { name: "跳过民俗，加入重点候选" }).click();
  }
  await page.getByRole("button", { name: "并卷比较", exact: true }).click();

  const comparison = page.getByRole("region", { name: "重点候选同属性比较" });
  await expect(comparison).toBeVisible();
  await expect(comparison.getByRole("columnheader")).toHaveCount(4);
  await expect(comparison.getByRole("rowheader", { name: "寓意" })).toBeVisible();
});
