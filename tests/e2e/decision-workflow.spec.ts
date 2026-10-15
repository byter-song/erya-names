import { expect, test } from "@playwright/test";
import { chooseNames, createProject } from "./helpers";

test("builds a multi-name final list with source explanations and folklore", async ({
  page,
}) => {
  const id = await createProject(page);
  const names = await chooseNames(page);
  const dialog = page.getByRole("dialog");

  await page.getByRole("button", { name: `查看${names[0]}详情` }).click();
  await dialog.getByRole("combobox", { name: "个人评分" }).selectOption("5");
  await dialog.getByRole("textbox", { name: "心选理由" }).fill("第一批保留");
  await dialog.getByRole("button", { name: "保存评价" }).click();
  await expect(dialog.getByRole("status")).toHaveText("评价已保存");
  await dialog.getByRole("button", { name: "进入民俗候选", exact: true }).click();
  for (const name of names.slice(1)) {
    await page.getByRole("button", { name: `查看${name}详情` }).click();
    await dialog.getByRole("button", { name: "进入民俗候选", exact: true }).click();
  }

  await page.getByRole("button", { name: /03\s*民俗候选/ }).click();
  await page.getByRole("button", { name: "民俗设置", exact: true }).click();
  await dialog.getByRole("checkbox", { name: "采用传统民俗参考" }).check();
  await dialog.getByLabel("民俗出生时间", { exact: true }).fill("2024-02-10T12:00");
  await dialog.getByRole("checkbox", { name: "水", exact: true }).check();
  await dialog.getByRole("button", { name: "保存并重新评估民俗候选" }).click();
  await expect(dialog.getByRole("status").filter({ hasText: "已更新" })).toBeVisible();
  await dialog.getByRole("button", { name: "完成并返回长卷" }).click();

  await page.getByRole("button", { name: `查看${names[0]}详情` }).click();
  await expect(dialog).toContainText("藏干");
  await expect(dialog).toContainText("这个名字的民俗解释");
  await dialog.getByRole("button", { name: "加入重点候选", exact: true }).click();
  for (const name of names.slice(1)) {
    await page.getByRole("button", { name: `查看${name}详情` }).click();
    await dialog.getByRole("button", { name: "加入重点候选", exact: true }).click();
  }

  await page.getByRole("button", { name: "并卷比较", exact: true }).click();
  await page.getByRole("button", { name: "保存对比快照" }).click();
  await expect(page.getByRole("status")).toHaveText("对比快照已保存");
  for (const name of names)
    await page.getByRole("button", { name: `将${name}加入定稿名单` }).click();
  await page.getByRole("button", { name: "查看定稿名单" }).click();
  await expect(page.getByLabel(`${names[0]}的保留理由`)).toHaveValue("第一批保留");
  await expect(page.getByText("个人评分 5 分")).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出定稿名单" }).click();
  await expect((await download).suggestedFilename()).toBe("erya-final-list.txt");
  await page.goto("/");
  await expect(page.getByText(`定稿 ${names.length} / 5`)).toBeVisible();
  await page.goto(`/projects/${id}/candidates`);
  await expect(page).toHaveURL(new RegExp(`/projects/${id}/generate$`));
});
