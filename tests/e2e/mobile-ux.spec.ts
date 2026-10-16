import { expect, test } from "@playwright/test";
import { createProject } from "./helpers";

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

test("keeps the four-pool controls usable at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  const projectId = await createProject(page);
  await page.goto(`/projects/${projectId}/names`);

  const name = (await page.locator(".ils__panel h2").first().textContent())!;
  await page.getByRole("button", { name: `选择${name}进入下一阶段` }).click();
  await page.getByRole("button", { name: "候选池（1）" }).click();
  await page.getByRole("button", { name: "并列比较候选" }).click();
  const comparison = page.getByRole("dialog", { name: "候选名字并列比较" });
  await expect(comparison.getByRole("columnheader", { name: new RegExp(name) })).toBeVisible();
  await comparison.getByRole("button", { name: "关闭比较" }).click();

  await page.getByRole("button", { name: `排除${name}` }).click();
  await page.getByRole("button", { name: "已排除（1）" }).click();
  await page.getByRole("button", { name: new RegExp(`恢复${name}到候选池`) }).click();
  await expect(page.getByText("目前没有已排除的名字。")).toBeVisible();

  const dock = page.locator(".ils__dock");
  await dock.scrollIntoViewIfNeeded();
  const dockBox = await dock.boundingBox();
  expect(dockBox).not.toBeNull();
  expect(dockBox!.x).toBeGreaterThanOrEqual(0);
  expect(dockBox!.x + dockBox!.width).toBeLessThanOrEqual(320);
  for (const button of await dock.getByRole("button").all()) {
    const box = await button.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
