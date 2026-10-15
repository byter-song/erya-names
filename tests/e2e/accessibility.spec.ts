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
  await page.getByRole("button", { name: "展卷 · 生成 9 个名字" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".ils__panel").first()).toBeVisible();
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
  expect(animationName).toBe("none");
  expect(
    await page
      .getByRole("button", { name: /起名条件/ })
      .evaluate((element) => getComputedStyle(element, "::after").animationName),
  ).toBe("none");
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

    const names = (await page.locator(".ils__panel h2").allTextContents()).slice(0, 2);
    for (const name of names) {
      const panel = page.locator(".ils__panel").filter({ hasText: name });
      await panel.getByRole("button", { name: "保留到基础候选", exact: true }).click();
    }
    await page.getByRole("button", { name: /02\s*基础候选/ }).click();
    for (const name of names.slice(0, 2)) {
      await page.getByRole("button", { name: `查看${name}详情` }).click();
      const add = page
        .getByRole("dialog")
        .getByRole("button", { name: "跳过民俗，加入重点候选" });
      await add.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
    await page.getByRole("button", { name: "并卷比较" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "重点候选" })).toBeVisible();
    await expectNoSeriousViolations(page);
  },
);
