import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createProject } from "./helpers";

test("reopens an existing project and deletes it after confirmation", async ({ page }) => {
  const projectId = await createProject(page);

  await page.goto(`/projects/${projectId}`);
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/generate$`));
  await expect(page.getByRole("heading", { name: "生名与初选", exact: true })).toBeVisible();

  await page.goto("/");
  await page.evaluate(() => {
    document.body.dataset.clientNavigationSentinel = "present";
  });
  await page.getByRole("link", { name: "继续方案" }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/generate$`));
  await expect(page.locator("body")).toHaveAttribute(
    "data-client-navigation-sentinel",
    "present",
  );

  await page.goto("/");
  await page.getByRole("button", { name: /删除方案/ }).click();
  await expect(page.getByRole("dialog", { name: "删除起名方案" })).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(
    accessibility.violations.filter((item) =>
      ["serious", "critical"].includes(item.impact ?? ""),
    ),
  ).toEqual([]);
  await page.getByRole("button", { name: "确认删除" }).click();
  await expect(page.getByRole("heading", { name: "开始第一个起名方案" })).toBeVisible();
  await expect(page.getByRole("link", { name: "继续方案" })).toHaveCount(0);

  await page.goto(`/projects/${projectId}/generate`);
  await expect(page.getByRole("heading", { name: "暂时无法打开方案" })).toBeVisible();
});
