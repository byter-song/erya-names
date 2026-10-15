import { expect, type Page } from "@playwright/test";
export async function createProject(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "新建起名方案" }).click();
  await page.getByLabel("姓氏", { exact: true }).fill("宋");
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByLabel("没有", { exact: true }).check();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByLabel("清朗自然", { exact: true }).check();
  await page.getByRole("button", { name: "完成建档，开始选名" }).click();
  await expect(page.getByRole("heading", { name: /氏命名场$/ })).toBeVisible();
  await page.getByRole("button", { name: /^(播种 9 个名字|生成一批)$/ }).click();
  await expect(page.locator(".candidate-card")).toHaveCount(9);
  return page.url().match(/projects\/([^/]+)/)![1]!;
}
export async function chooseNames(page: Page, count = 3) {
  const names = (await page.locator(".candidate-card h2").allTextContents()).slice(0, count);
  for (const name of names)
    await page.getByRole("button", { name: `保留到基础候选${name}`, exact: true }).click();
  await page.getByRole("button", { name: /^基础候选/ }).click();
  await expect(page.locator(".candidate-card")).toHaveCount(count);
  return names;
}
export async function compareAndFinalize(page: Page, names: string[]) {
  for (const name of names) {
    const card = page
      .locator(".candidate-card")
      .filter({ has: page.getByRole("heading", { name, exact: true }) });
    const skip = card.getByRole("button", { name: "跳过民俗，加入重点候选" });
    const reviewed = card.getByRole("button", { name: "加入重点候选" });
    if (await skip.count()) await skip.click();
    else if (await reviewed.count()) await reviewed.click();
  }
  await page.getByRole("button", { name: "打开重点候选" }).click();
  await page.getByRole("button", { name: "保存对比快照" }).click();
  await expect(page.getByRole("status")).toHaveText("对比快照已保存");
  for (const name of names)
    await page.getByRole("button", { name: `将${name}加入定稿名单` }).click();
  await expect(page.getByRole("button", { name: "查看定稿名单" })).toBeVisible();
  await expect(page.getByRole("region", { name: "定稿名单" })).toContainText(
    `定稿名单 ${names.length} / 5`,
  );
  await page.reload();
  await expect(page.getByRole("region", { name: "定稿名单" })).toContainText(
    `定稿名单 ${names.length} / 5`,
  );
  await expect(
    page.getByText("重点候选已处理完。上方定稿名单仍然完整保存，可继续调整。"),
  ).toBeVisible();
  await page.getByRole("button", { name: "查看定稿名单" }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "定稿名单" })).toBeVisible();
  for (const name of names) await expect(page.getByRole("heading", { name })).toBeVisible();
}
