import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

async function expectNoSeriousViolations(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? "")),
  ).toEqual([]);
}

async function createGeneratedProject(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "展新卷 · 新建方案" }).first().click();
  await page.getByLabel("姓氏", { exact: true }).fill("宋");
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await page.getByRole("radio", { name: "没有", exact: true }).check();
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await page.getByRole("button", { name: "完成建档，开始选名" }).click();
  await expectNoSeriousViolations(page);
  await page.getByRole("link", { name: "进入名字长卷" }).click();
  await page.getByRole("button", { name: "展卷 · 生成 9 个名字" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".ils__panel").first()).toBeVisible();
  return page.url().match(/projects\/([^/]+)/)![1]!;
}

test(
  "project center has no serious accessibility violations",
  { tag: "@accessibility" },
  async ({ page }) => {
    await page.goto("/");
    await expectNoSeriousViolations(page);
  },
);

test(
  "the one-shot opening scene is gone after bootstrap",
  { tag: "@accessibility" },
  async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".startup-screen")).toHaveCount(0);
    await expect(page.getByTestId("ink-shell")).toBeVisible();
    await expect(page.locator(".ink-scene__opening-brush")).toHaveCount(0);
  },
);

test(
  "onboarding is keyboard operable and reduced motion disables ink animation",
  { tag: "@accessibility" },
  async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Full keyboard tab order is validated in Chromium");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const create = page.getByRole("button", { name: "展新卷 · 新建方案" }).first();
    await expect(create).toBeVisible();
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await page.keyboard.press("Tab");
      if (await create.evaluate((element) => element === document.activeElement)) break;
    }
    await expect(create).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "创建起名方案" })).toBeVisible();
    await expect(page.getByTestId("gold-ink-canvas")).toHaveCount(0);
    expect(
      await page
        .locator(".condition-environment__ambient span")
        .first()
        .evaluate((element) => getComputedStyle(element).animationName),
    ).toBe("none");
  },
);

test("the mounted scene exposes no persistent motion control", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /水墨动效/ })).toHaveCount(0);
  await expect(page.locator("canvas")).toHaveCount(0);
});

test("sidebar navigation does not force page transition animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const target = page.getByRole("button", { name: /起名条件/ });
  expect(await target.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe(
    "0s",
  );
  await page.evaluate(() => {
    document.body.dataset.clientNavigationSentinel = "present";
  });
  await target.click();
  await expect(page).toHaveURL(/\/projects\/new\/basic$/);
  await expect(page.locator("body")).toHaveAttribute(
    "data-client-navigation-sentinel",
    "present",
  );
  await expect(page.locator(".startup-screen")).toHaveCount(0);
  const animationName = await page
    .locator("main")
    .evaluate((element) => getComputedStyle(element).animationName);
  expect(["", "none"]).toContain(animationName);
  expect(
    await page
      .getByRole("button", { name: /起名条件/ })
      .evaluate((element) => getComputedStyle(element, "::after").animationName),
  ).toBe("none");
});

test(
  "generation, four-pool dialog and comparison are keyboard operable and axe-clean",
  { tag: "@accessibility" },
  async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Full keyboard interaction is validated in Chromium");
    await createGeneratedProject(page);
    await expectNoSeriousViolations(page);
    await page.getByRole("button", { name: "手工添加姓名" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "手工添加候选" })).toBeFocused();
    await expectNoSeriousViolations(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "手工添加姓名" })).toBeFocused();

    const names = (await page.locator(".ils__panel h2").allTextContents()).slice(0, 2);
    for (const name of names) {
      await page.getByRole("button", { name: `选择${name}进入下一阶段` }).click();
    }
    await page.getByRole("button", { name: "候选池（2）" }).click();
    await page.getByRole("button", { name: "并列比较候选" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "候选名字并列比较" })).toBeFocused();
    await expectNoSeriousViolations(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "并列比较候选" })).toBeFocused();
  },
);

test(
  "configuration errors expose text and move focus to the failing section",
  { tag: "@accessibility" },
  async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Focus placement is validated in Chromium");
    const projectId = await createGeneratedProject(page);
    await page.goto(`/projects/${projectId}/config#configuration-basics`);
    await expect(page.getByRole("navigation", { name: "配置章节" })).toBeVisible();

    await page.getByLabel("姓氏", { exact: true }).fill("");
    await page.getByRole("button", { name: "保存配置" }).click();

    const errors = page.getByRole("alert").filter({ hasText: "还有内容需要检查" });
    await expect(errors).toContainText("方案与表达");
    await expect(errors).toContainText(/配置|姓氏|校验/);
    await expect(page.locator("#configuration-basics > summary")).toBeFocused();
    await expectNoSeriousViolations(page);
  },
);
