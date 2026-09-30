import { expect, test } from "@playwright/test";

test("loads a nested project route directly through the static preview server", async ({
  page,
}) => {
  await page.goto("/projects/project-1");

  await expect(page).toHaveURL(/\/projects\/project-1$/);
  await expect(page.getByRole("heading", { name: "无法打开方案" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("未找到这个起名方案");
});
