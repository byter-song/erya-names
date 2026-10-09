import { expect, test } from "@playwright/test";
import { createProject } from "./helpers";
test("generates on the same page and only selected names enter the persistent shortlist", async ({
  page,
}) => {
  const id = await createProject(page);
  const names = await page.locator(".candidate-card h2").allTextContents();
  await page.getByRole("button", { name: /^基础候选/ }).click();
  await expect(page.locator(".candidate-card")).toHaveCount(0);
  await page.getByRole("button", { name: /灵感池/ }).click();
  const name = names[0]!;
  await page.getByRole("button", { name: `保留到基础候选${name}`, exact: true }).click();
  await page.getByRole("button", { name: /^基础候选/ }).click();
  await expect(page.locator(".candidate-card")).toHaveCount(1);
  await expect(page).toHaveURL(new RegExp(`/projects/${id}/generate#basic$`));
  await page.reload();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.locator(".candidate-card")).toHaveCount(1);
  await page.getByRole("button", { name: "下一步：进入民俗候选" }).click();
  await expect(page.getByRole("button", { name: /^基础候选.*1$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^民俗候选.*1$/ })).toBeVisible();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await page.getByRole("button", { name: `查看${name}详情` }).click();
  await expect(page.getByRole("dialog")).toContainText("逐字读懂");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: `查看${name}详情` })).toBeFocused();
});

test("shows a newly generated batch immediately and keeps history one click away", async ({
  page,
}) => {
  await createProject(page);
  const firstBatch = await page.locator(".candidate-card h2").allTextContents();

  await page.getByRole("button", { name: "再生成一批" }).click();
  await expect(page.getByText("已保存 18 个名字")).toBeVisible();
  await expect(page.getByRole("button", { name: "最新一批" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(".candidate-card")).toHaveCount(9);
  const secondBatch = await page.locator(".candidate-card h2").allTextContents();
  expect(secondBatch.some((name) => firstBatch.includes(name))).toBe(false);

  await page.getByRole("button", { name: "全部灵感" }).click();
  await expect(page.getByText("筛选结果 18 条，当前显示 9 条")).toBeVisible();
  await page.getByRole("button", { name: "显示更多历史灵感" }).click();
  await expect(page.locator(".candidate-card")).toHaveCount(18);
});

test("keeps important and final stages blocked while family rules are unknown", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "新建起名方案" }).click();
  await page.getByLabel("姓氏", { exact: true }).fill("顾");
  await page.getByRole("button", { name: "下一步" }).click();
  await expect(page.getByLabel("不确定", { exact: true })).toBeChecked();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "完成建档，开始选名" }).click();
  await page.getByRole("button", { name: "生成一批" }).click();
  const name = (await page.locator(".candidate-card h2").first().textContent())!;
  await page.getByRole("button", { name: `保留到基础候选${name}`, exact: true }).click();
  await page.getByRole("link", { name: "基础候选" }).click();
  await expect(page.getByRole("button", { name: "下一步：进入民俗候选" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "跳过民俗，加入重点候选" })).toBeDisabled();
  await page.getByRole("link", { name: "重点候选" }).click();
  await expect(page.getByRole("heading", { name: "重点候选暂时锁定" })).toBeVisible();
  await page.getByRole("button", { name: "核对家庭规则" }).click();
  await expect(page).toHaveURL(/\/generate#conditions$/);
});
