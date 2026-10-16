import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createProject } from "./helpers";

test("reopens an existing project and deletes it after confirmation", async ({ page }) => {
  const projectId = await createProject(page);

  await page.goto(`/projects/${projectId}`);
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/names$`));
  await expect(page.getByRole("heading", { name: "灵感池 9 个", exact: true })).toBeVisible();

  await page.goto("/");
  await page.evaluate(() => {
    document.body.dataset.clientNavigationSentinel = "present";
  });
  await page.getByRole("link", { name: "继续方案" }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/names$`));
  await expect(page.locator("body")).toHaveAttribute(
    "data-client-navigation-sentinel",
    "present",
  );

  await page.goto("/");
  await page.getByRole("button", { name: /删除方案/ }).click();
  await expect(page.getByRole("dialog", { name: "删除起名方案" })).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(
    accessibility.violations.filter((item) =>
      ["serious", "critical"].includes(item.impact ?? ""),
    ),
  ).toEqual([]);
  await page.getByRole("button", { name: "确认删除" }).click();
  await expect(page.getByRole("heading", { name: "铺开第一卷" })).toBeVisible();
  await expect(page.getByRole("link", { name: "继续方案" })).toHaveCount(0);

  await page.goto(`/projects/${projectId}/names`);
  await expect(page.getByRole("heading", { name: "暂时无法打开方案" })).toBeVisible();
});

test("manages three isolated versions for the same surname", async ({ page }) => {
  await createNamedProject(page, "宋姓·古典卷", true);
  await createNamedProject(page, "宋姓·现代卷", false);

  await page.goto("/");
  await expect(page.getByText("宋姓方案")).toHaveCount(2);

  const classicCard = projectCard(page, "宋姓·古典卷");
  await classicCard.getByRole("button", { name: "重命名方案宋姓·古典卷" }).click();
  await classicCard.getByLabel("方案版本名").fill("宋姓·诗礼卷");
  await classicCard.getByRole("button", { name: "保存名称" }).click();
  const renamedClassicCard = projectCard(page, "宋姓·诗礼卷");
  await expect(renamedClassicCard).toBeVisible();

  await renamedClassicCard.getByRole("button", { name: "复制配置宋姓·诗礼卷" }).click();
  await renamedClassicCard.getByLabel("新版本名").fill("宋姓·诗礼卷·备选");
  await renamedClassicCard.getByRole("button", { name: "复制配置", exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/config$/);
  await expect(page.getByText("统一配置 · 一页完成")).toBeVisible();

  await page.goto("/");
  await expect(page.getByText("宋姓方案")).toHaveCount(3);
  await expect(projectCard(page, "宋姓·诗礼卷")).toContainText("灵感 9");
  await expect(projectCard(page, "宋姓·现代卷")).toContainText("灵感 0");
  await expect(projectCard(page, "宋姓·诗礼卷·备选")).toContainText("灵感 0");

  const copyCard = projectCard(page, "宋姓·诗礼卷·备选");
  await copyCard.getByRole("button", { name: "重命名方案宋姓·诗礼卷·备选" }).click();
  await copyCard.getByLabel("方案版本名").fill("宋姓·诗礼卷·第二版");
  await copyCard.getByRole("button", { name: "保存名称" }).click();
  await expect(projectCard(page, "宋姓·诗礼卷·第二版")).toBeVisible();
  await expect(page.getByRole("heading", { name: "宋姓·诗礼卷", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "宋姓·现代卷", exact: true })).toBeVisible();
});

async function createNamedProject(
  page: import("@playwright/test").Page,
  title: string,
  generate: boolean,
) {
  await page.goto("/");
  await page.getByRole("button", { name: "展新卷 · 新建方案" }).first().click();
  await page.getByLabel("方案名称", { exact: true }).fill(title);
  await page.getByLabel("姓氏", { exact: true }).fill("宋");
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await page.getByRole("radio", { name: "没有", exact: true }).check();
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await page.getByRole("button", { name: "完成建档，开始选名" }).click();
  await expect(page.getByText("统一配置 · 一页完成")).toBeVisible();
  await page.getByRole("link", { name: "进入名字长卷" }).click();
  const generateButton = page.getByRole("button", { name: "展卷 · 生成 9 个名字" });
  await expect(generateButton).toBeVisible();
  if (generate) {
    await generateButton.click();
    await expect(page.getByRole("heading", { name: "灵感池 9 个" })).toBeVisible();
  }
}

function projectCard(page: import("@playwright/test").Page, title: string) {
  return page.locator(".project-card").filter({
    has: page.getByRole("heading", { name: title, exact: true }),
  });
}
