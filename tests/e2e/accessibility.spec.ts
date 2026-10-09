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
  await page.getByRole("button", { name: "新建起名方案" }).click();
  await page.getByLabel("姓氏", { exact: true }).fill("宋");
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByLabel("没有", { exact: true }).check();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByLabel("清朗自然").check();
  await page.getByRole("button", { name: "完成建档，开始选名" }).click();
  await expectNoSeriousViolations(page);
  await page.getByRole("button", { name: "生成一批" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".candidate-card").first()).toBeVisible();
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
    await expect(page.locator(".ink-scene__opening-brush")).toHaveCount(1);
  },
);

test(
  "onboarding is keyboard operable and reduced motion disables ink animation",
  { tag: "@accessibility" },
  async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Full keyboard tab order is validated in Chromium");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "新建起名方案" })).toBeVisible();
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await page.keyboard.press("Tab");
      if (
        (await page.evaluate(() => document.activeElement?.textContent?.trim())) ===
        "新建起名方案"
      )
        break;
    }
    await expect(page.getByRole("button", { name: "新建起名方案" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "创建起名方案" })).toBeVisible();
    await expect(page.getByTestId("gold-ink-canvas")).toHaveCount(0);
    expect(
      await page
        .locator(".ink-scene__opening-brush")
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
  await page.goto("/");
  const target = page.getByRole("link", { name: "起名条件" });
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
  expect(animationName).toBe("none");
  expect(
    await page
      .getByRole("link", { name: "起名条件" })
      .evaluate((element) => getComputedStyle(element, "::after").animationName),
  ).toBe("none");
});

test("the dark theme toggle persists and remains axe-clean", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "切换为暗色主题" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expectNoSeriousViolations(page);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "切换为亮色主题" })).toBeVisible();
});

test(
  "generation, funnel, dialog and comparison are keyboard operable and axe-clean",
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

    const names = await page.locator(".candidate-card h2").allTextContents();
    for (const name of names.slice(0, 2))
      await page.getByRole("button", { name: `保留到基础候选${name}`, exact: true }).click();
    await page.getByRole("button", { name: /^基础候选/ }).click();
    for (const name of names.slice(0, 2)) {
      const add = page
        .locator(".candidate-card")
        .filter({ hasText: name })
        .getByRole("button", { name: "跳过民俗，加入重点候选" });
      await add.focus();
      await page.keyboard.press("Enter");
      await expect(add).toBeHidden();
    }
    await page.getByRole("button", { name: "打开重点候选" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "重点候选" })).toBeVisible();
    await expectNoSeriousViolations(page);
  },
);
