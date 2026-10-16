import { expect, test, type Page } from "@playwright/test";
import { createProject } from "./helpers";

test("completes the four-pool decision workflow in the names scroll", async ({ page }) => {
  const projectId = await createProject(page);
  await page.goto(`/projects/${projectId}/names`);
  await expect(page.getByRole("heading", { name: "灵感池 9 个" })).toBeVisible();

  const names = (await page.locator(".ils__panel h2").allTextContents()).slice(0, 3);
  expect(names).toHaveLength(3);
  const [first, second, third] = names as [string, string, string];

  await selectForward(page, first);
  await selectForward(page, second);
  await expect(page.getByRole("button", { name: "候选池（2）" })).toBeVisible();

  await page.getByRole("button", { name: "候选池（2）" }).click();
  await page.getByRole("button", { name: "并列比较候选" }).click();
  const comparison = page.getByRole("dialog", { name: "候选名字并列比较" });
  await expect(comparison.getByRole("columnheader", { name: new RegExp(first) })).toBeVisible();
  await expect(
    comparison.getByRole("columnheader", { name: new RegExp(second) }),
  ).toBeVisible();
  await comparison.getByRole("button", { name: "关闭比较" }).click();

  await selectForward(page, first);
  await expect(page.getByRole("button", { name: "精选池（1）" })).toBeVisible();
  await moveBackward(page, second);
  await page.getByRole("button", { name: "撤销上一步" }).click();
  await expect(page.getByRole("heading", { name: "候选池 1 个" })).toBeVisible();

  await page.getByRole("button", { name: "灵感池（7）" }).click();
  await page.getByRole("button", { name: `排除${third}` }).click();
  await page.getByRole("button", { name: "已排除（1）" }).click();
  await expect(page.getByRole("heading", { name: "已排除的名字" })).toBeVisible();
  await expect(page.getByText("从长卷卡片排除")).toBeVisible();

  await page.getByRole("button", { name: new RegExp(`恢复${third}到灵感池`) }).click();
  await expect(page.getByText("目前没有已排除的名字。")).toBeVisible();

  await page.getByRole("button", { name: "灵感池（7）" }).click();
  await page.getByRole("button", { name: `排除${third}` }).click();
  await page.getByRole("button", { name: "已排除（1）" }).click();
  await page.getByLabel(`选择永久清空${third}`).check();
  await page.getByRole("button", { name: "永久清空已勾选的 1 个名字" }).click();
  const clear = page.getByRole("dialog", { name: "确认永久清空" });
  await clear.getByLabel("输入数字 1 以确认").fill("1");
  await clear.getByRole("button", { name: "确认永久删除 1 个名字" }).click();
  await expect(page.getByText("目前没有已排除的名字。")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "已排除 0 个" })).toBeVisible();
  await page.getByRole("button", { name: "精选池（1）" }).click();
  await expect(page.getByRole("heading", { name: first })).toBeVisible();
});

async function selectForward(page: Page, name: string) {
  await page.getByRole("button", { name: `选择${name}进入下一阶段` }).click();
}

async function moveBackward(page: Page, name: string) {
  await page.getByRole("button", { name: `移除${name}并返回上一阶段` }).click();
}
