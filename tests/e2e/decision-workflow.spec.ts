import { expect, test } from "@playwright/test";
import { createProject, chooseNames, compareAndFinalize } from "./helpers";
test("completes a personal decision with source explanations, folklore and a printable report", async ({
  page,
  browserName,
}) => {
  const id = await createProject(page, true);
  const names = await chooseNames(page);
  await page.getByLabel(`评分${names[0]}`).selectOption("5");
  await page.getByLabel(`备注${names[0]}`).fill("第一批保留");
  await page.getByLabel(`备注${names[0]}`).blur();
  await page.getByRole("button", { name: `查看${names[0]}详情` }).click();
  await expect(page.getByRole("dialog")).toContainText("藏干");
  await expect(page.getByRole("dialog")).toContainText("这个名字的民俗解释");
  await page.getByRole("button", { name: "关闭详情" }).click();
  await page.getByRole("button", { name: "生成 48 个名字", exact: true }).click();
  await expect(page.getByText("已保存 96 个名字")).toBeVisible();
  await page.getByRole("button", { name: /我的候选/ }).click();
  await expect(page.getByLabel(`评分${names[0]}`)).toHaveValue("5");
  await expect(page.getByLabel(`备注${names[0]}`)).toHaveValue("第一批保留");
  await compareAndFinalize(page, names);
  await page.getByRole("button", { name: "预览定稿报告" }).click();
  await expect(page.locator(".final-report")).toContainText("逐字释义");
  await expect(page.locator(".final-report")).toContainText("出生时序");
  await page.getByLabel("隐藏出生信息").check();
  await page.getByLabel("隐藏民俗参考").check();
  await page.getByLabel("隐藏个人备注").check();
  await expect(page.locator(".final-report")).not.toContainText("2024-02-10");
  await expect(page.locator(".final-report")).not.toContainText("出生时序");
  await expect(page.locator(".final-report")).not.toContainText("第一批保留");
  await page.evaluate(() => {
    window.print = () => document.documentElement.setAttribute("data-print-called", "true");
  });
  await page.getByRole("button", { name: "打印或保存 PDF" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-print-called", "true");
  if (browserName === "chromium")
    await page.pdf({
      path: "output/playwright/final-report.pdf",
      format: "A4",
      printBackground: true,
    });
  await page.reload();
  await expect(page.getByLabel(`选择${names[0]}`)).toBeChecked();
  await page.goto("/");
  await expect(page.getByText("已完成", { exact: true })).toBeVisible();
  await page.goto(`/projects/${id}/candidates`);
  await expect(page).toHaveURL(new RegExp(`/projects/${id}/generate$`));
});
