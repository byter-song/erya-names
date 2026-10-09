import { expect, test } from "@playwright/test";
import { createProject, chooseNames } from "./helpers";
test("supports manual names, saved filters, undo and comparison snapshots", async ({
  page,
}) => {
  await createProject(page);
  const selected = await chooseNames(page, 1);
  await page.getByRole("button", { name: "手工添加姓名" }).click();
  await page.getByLabel("完整姓名").fill("宋泽谦");
  await page.getByLabel("来源说明").fill("家人提议");
  await page.getByLabel("释义", { exact: true }).fill("温润谦和");
  await page.getByRole("button", { name: "保存手工候选" }).click();
  await expect(page.getByRole("heading", { name: "宋泽谦", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "查看宋泽谦详情" }).click();
  await expect(page.getByRole("dialog")).toContainText("温润谦和");
  await page.getByRole("button", { name: "关闭详情" }).click();
  await page.getByLabel("筛选来源").selectOption("user_input");
  await page.reload();
  await expect(page.getByLabel("筛选来源")).toHaveValue("user_input");
  await expect(page.locator(".candidate-card")).toHaveCount(1);
  await page.getByLabel("筛选来源").selectOption("all");
  const card = page
    .locator(".candidate-card")
    .filter({ has: page.getByRole("heading", { name: "宋泽谦", exact: true }) });
  await card.getByRole("button", { name: "跳过民俗，加入重点候选" }).click();
  await expect(card.getByText("已入重点", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "撤销上一步" }).click();
  await expect(card.getByRole("button", { name: "跳过民俗，加入重点候选" })).toBeVisible();
  for (const name of [...selected, "宋泽谦"])
    await page
      .locator(".candidate-card")
      .filter({ has: page.getByRole("heading", { name, exact: true }) })
      .getByRole("button", { name: "跳过民俗，加入重点候选" })
      .click();
  await page.getByRole("button", { name: "打开重点候选" }).click();
  await page.getByRole("button", { name: "保存对比快照" }).click();
  await page.getByRole("button", { name: "查看本轮对比" }).click();
  await expect(page.getByRole("dialog")).toContainText("宋泽谦");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: `将${selected[0]}加入定稿名单` }).click();
  await page.getByRole("button", { name: "撤销上一步" }).click();
  await expect(
    page.getByRole("button", { name: `将${selected[0]}加入定稿名单` }),
  ).toBeEnabled();
});
test("edits constraints, enforces a fixed generation character and explains unknown time", async ({
  page,
}) => {
  await createProject(page);
  await page.locator("#conditions>summary").click();
  await page.getByLabel("指定字与字辈").fill("知:1");
  await page.getByLabel("避字", { exact: true }).fill("远");
  await page.getByRole("button", { name: "保存起名条件" }).click();
  await expect(page.getByText("条件已保存，下一批将使用新条件。")).toBeVisible();
  await page.locator("#conditions>summary").click();
  await page.getByRole("button", { name: "生成一批", exact: true }).click();
  await expect(page.getByText("已保存 18 个名字")).toBeVisible();
  await page.getByLabel("搜索姓名").fill("宋知");
  const names = await page.locator(".candidate-card h2").allTextContents();
  expect(names.length).toBeGreaterThan(0);
  expect(names.every((name) => name.startsWith("宋知") && !name.includes("远"))).toBe(true);
  await page.getByRole("button", { name: `保留到基础候选${names[0]}`, exact: true }).click();
  await page.getByRole("button", { name: /^基础候选/ }).click();
  await page.getByRole("button", { name: "下一步：进入民俗候选" }).click();
  await page.getByRole("button", { name: /^民俗候选/ }).click();
  await page.getByLabel("时辰不详，只看三柱").check();
  await page.getByLabel("民俗出生时间").fill("2024-02-10");
  await page.getByRole("button", { name: "保存并重新评估民俗候选" }).click();
  await page.getByRole("button", { name: `查看${names[0]}详情` }).click();
  await expect(page.getByRole("dialog")).toContainText("时辰不详，不补算");
});

test("keeps existing local projects accessible when the corpus asset cannot load", async ({
  page,
}) => {
  const id = await createProject(page);
  await chooseNames(page, 1);
  await page.route("**/data/names-*.json", (route) => route.abort());
  await page.reload();
  await expect(page.getByRole("button", { name: "打开已有方案与备份" })).toBeVisible();
  await page.getByRole("button", { name: "打开已有方案与备份" }).click();
  await page.getByRole("link", { name: "灵感池" }).click();
  await expect(page.getByRole("button", { name: "生成一批", exact: true })).toBeDisabled();
  await page.getByRole("link", { name: "基础候选" }).click();
  await expect(page.locator(".candidate-card")).toHaveCount(1);
  await page.goto(`/projects/${id}/backup`);
  await page.getByRole("button", { name: "打开已有方案与备份" }).click();
  await expect(page.getByRole("button", { name: "下载 JSON 备份" })).toBeVisible();
});
