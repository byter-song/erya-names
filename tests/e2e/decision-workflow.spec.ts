import { expect, test } from "@playwright/test";
import { createProject, chooseNames, compareAndFinalize } from "./helpers";
test("builds a multi-name final list with source explanations and folklore", async ({
  page,
}) => {
  const id = await createProject(page);
  const names = await chooseNames(page);
  await page.getByLabel(`评分${names[0]}`).selectOption("5");
  await page.getByLabel(`备注${names[0]}`).fill("第一批保留");
  await page.getByLabel(`备注${names[0]}`).blur();
  for (const name of names)
    await page
      .locator(".candidate-card")
      .filter({ has: page.getByRole("heading", { name, exact: true }) })
      .getByRole("button", { name: "下一步：进入民俗候选" })
      .click();
  await page.getByRole("button", { name: /^民俗候选/ }).click();
  await page.getByLabel("民俗出生时间").fill("2024-02-10T12:00");
  await page.getByRole("checkbox", { name: "水" }).check();
  await page.getByRole("button", { name: "保存并重新评估民俗候选" }).click();
  await expect(page.getByText("民俗设置和当前候选结果已更新。")).toBeVisible();
  await page.getByRole("button", { name: `查看${names[0]}详情` }).click();
  await expect(page.getByRole("dialog")).toContainText("藏干");
  await expect(page.getByRole("dialog")).toContainText("这个名字的民俗解释");
  await page.getByRole("button", { name: "关闭详情" }).click();
  await page.getByRole("button", { name: /^灵感池/ }).click();
  await page.getByRole("button", { name: "生成一批", exact: true }).click();
  await expect(page.getByText("已保存 18 个名字")).toBeVisible();
  await page.getByRole("button", { name: /^基础候选/ }).click();
  await expect(page.getByLabel(`评分${names[0]}`)).toHaveValue("5");
  await expect(page.getByLabel(`备注${names[0]}`)).toHaveValue("第一批保留");
  await compareAndFinalize(page, names);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出定稿名单" }).click();
  await expect((await download).suggestedFilename()).toBe("erya-final-list.txt");
  await page.goto("/");
  await expect(page.getByText(`定稿 ${names.length} / 5`)).toBeVisible();
  await page.goto(`/projects/${id}/candidates`);
  await expect(page).toHaveURL(new RegExp(`/projects/${id}/generate$`));
});
