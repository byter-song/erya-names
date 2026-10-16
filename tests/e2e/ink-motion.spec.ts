import { expect, test } from "@playwright/test";
import { createProject } from "./helpers";

test("the static long-scroll background ignores pointer input", async ({ page }) => {
  await page.goto("/");
  const mountains = page.locator(".ink-shell__mountains");
  await expect(mountains).toHaveCount(1);
  await expect(page.locator(".ink-scene__opening-brush")).toHaveCount(0);
  await expect(page.locator(".ink-scene__landscape")).toHaveCount(0);
  await expect(page.getByTestId("gold-ink-canvas")).toHaveCount(0);
  await expect(page.getByTestId("gold-ink-splash-canvas")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /水墨动效/ })).toHaveCount(0);

  const before = await mountains.evaluate((element) => getComputedStyle(element).transform);
  await page.mouse.move(760, 220);
  await page.mouse.click(1120, 240);
  await page.waitForTimeout(180);
  expect(await mountains.evaluate((element) => getComputedStyle(element).transform)).toBe(
    before,
  );
});

test("reduced motion disables long-scroll panel and control transitions", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await createProject(page);

  await expect(page.locator(".ils__panel.is-center")).toBeVisible();
  expect(
    await page
      .locator(".ils__panel.is-center")
      .evaluate((element) => getComputedStyle(element).transitionDuration),
  ).toBe("0s");
  expect(
    await page
      .getByRole("button", { name: "下一帧" })
      .evaluate((element) => getComputedStyle(element).transitionDuration),
  ).toBe("0s");
});
