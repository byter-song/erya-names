import { expect, test } from "@playwright/test";
import { createProject } from "./helpers";

test("unified configuration saves, recalculates and refreshes name evidence", async ({
  page,
}) => {
  const projectId = await createProject(page);
  await page.goto(`/projects/${projectId}/config#configuration-basics`);

  await expect(page.getByRole("heading", { name: /宋姓/ })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "配置章节" })).toBeVisible();
  await page.getByRole("button", { name: "基础", exact: true }).click();
  await page.getByRole("button", { name: "添加风格" }).click();
  await page.getByRole("textbox", { name: "风格偏好 1", exact: true }).fill("清朗自然");
  await expect(page.getByText("将重新分析 9 个名字。")).toBeVisible();
  await page.getByRole("button", { name: "保存配置" }).click();
  await expect(page.getByRole("status").filter({ hasText: /配置已保存/ })).toBeVisible();
  await expect(page.getByText("分析完成")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("link", { name: "进入名字长卷" }).click();
  const firstName = await page.locator(".ils__panel.is-center h2").innerText();
  await page.getByRole("button", { name: `查看${firstName}详情` }).click();
  await expect(page.getByRole("heading", { name: "规则证据与扣分过程" })).toBeVisible();
  await expect(page.getByText(/综合分/).first()).toBeVisible();
});
