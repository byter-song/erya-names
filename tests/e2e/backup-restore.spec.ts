import { expect, test } from "@playwright/test";
import { createProject } from "./helpers";

test("exports a project and restores the validated backup as a copy", async ({ page }) => {
  const projectId = await createProject(page);

  await page.goto(`/projects/${projectId}/backup`);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 JSON 备份" }).click();
  const download = await downloadPromise;
  const downloadedPath = await download.path();
  if (!downloadedPath) throw new Error("Expected a downloaded backup path");

  await page.goto("/recovery");
  await page.getByLabel("选择备份文件").setInputFiles(downloadedPath);
  await expect(page.getByText("检测到同 ID 方案")).toBeVisible();
  await page.getByLabel("冲突处理方式").selectOption("import-copy");
  await page.getByRole("button", { name: "确认恢复" }).click();
  await expect(page.getByRole("status")).toContainText("恢复完成");
  await expect(page.getByRole("status")).not.toContainText(projectId);
});

test("shows a useful error for a damaged backup without leaving the recovery page", async ({
  page,
}) => {
  await page.goto("/recovery");
  await page.getByLabel("选择备份文件").setInputFiles({
    name: "damaged-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"invalid":true}'),
  });

  await expect(page.getByRole("alert")).toContainText("备份版本不受支持");
  await expect(page).toHaveURL(/\/recovery$/);
  await expect(page.getByRole("button", { name: "重新预览备份" })).toBeVisible();
});
