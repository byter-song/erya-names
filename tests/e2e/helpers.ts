import { expect, type Page } from "@playwright/test";
export async function createProject(page: Page, folklore = false) {
  await page.goto("/");
  await page.getByRole("button", { name: "新建起名方案" }).click();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByLabel("清朗自然", { exact: true }).check();
  await page.getByRole("button", { name: "下一步" }).click();
  if (folklore) {
    await page.getByLabel("启用基础民俗参考").check();
    await page.getByLabel("出生时间").fill("2024-02-10T12:00");
  }
  await page.getByRole("button", { name: "完成建档并生成姓名" }).click();
  await expect(page.getByRole("heading", { name: "生名与初选", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "生成 48 个名字", exact: true }).click();
  await expect(page.locator(".candidate-card")).toHaveCount(48);
  return page.url().match(/projects\/([^/]+)/)![1]!;
}
export async function chooseNames(page: Page, count = 3) {
  const names = (await page.locator(".candidate-card h2").allTextContents()).slice(0, count);
  for (const name of names)
    await page.getByRole("button", { name: `收入候选${name}`, exact: true }).click();
  await page.getByRole("button", { name: /我的候选/ }).click();
  await expect(page.locator(".candidate-card")).toHaveCount(count);
  return names;
}
export async function compareAndFinalize(page: Page, names: string[]) {
  for (const name of names)
    await page
      .locator(".candidate-card")
      .filter({ has: page.getByRole("heading", { name, exact: true }) })
      .getByRole("button", { name: "加入对比" })
      .click();
  await page.getByRole("button", { name: "打开候选对比" }).click();
  await page.getByRole("button", { name: "保存对比快照" }).click();
  await expect(page.getByRole("status")).toHaveText("对比快照已保存");
  for (const name of names)
    await page.getByRole("button", { name: `将${name}列为最终候选` }).click();
  await expect(page.getByRole("button", { name: "进入最终定稿" })).toBeVisible();
  await expect(page.getByRole("region", { name: "已选最终候选" })).toContainText(
    `已选最终候选 ${names.length} / 5`,
  );
  await page.reload();
  await expect(page.getByRole("region", { name: "已选最终候选" })).toContainText(
    `已选最终候选 ${names.length} / 5`,
  );
  await expect(
    page.getByText("待比较列表已处理完。上方最终候选仍然完整保存，可以继续定稿或移回对比。"),
  ).toBeVisible();
  await page.getByRole("button", { name: "进入最终定稿" }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "最终定稿" })).toBeVisible();
  await page.getByLabel(`选择${names[0]}`).check();
  await page.getByLabel("最终选择说明").fill("出处清楚，读音合适，全家喜欢。");
  await page.getByRole("button", { name: "保存最终选择" }).click();
  await expect(page.getByRole("status")).toContainText(names[0]!);
}
