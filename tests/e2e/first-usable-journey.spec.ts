import { expect, test } from "@playwright/test";
import { createProject } from "./helpers";
test("generates on the same page and only selected names enter the persistent shortlist", async ({
  page,
}) => {
  const id = await createProject(page);
  const names = await page.locator(".candidate-card h2").allTextContents();
  await page.getByRole("button", { name: /我的候选/ }).click();
  await expect(page.locator(".candidate-card")).toHaveCount(0);
  await page.getByRole("button", { name: /灵感池/ }).click();
  const name = names[0]!;
  await page.getByRole("button", { name: `收入候选${name}`, exact: true }).click();
  await page.getByRole("button", { name: /我的候选/ }).click();
  await expect(page.locator(".candidate-card")).toHaveCount(1);
  await expect(page).toHaveURL(new RegExp(`/projects/${id}/generate$`));
  await page.reload();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.locator(".candidate-card")).toHaveCount(1);
  await page.getByRole("button", { name: `查看${name}详情` }).click();
  await expect(page.getByRole("dialog")).toContainText("逐字读懂");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: `查看${name}详情` })).toBeFocused();
});
