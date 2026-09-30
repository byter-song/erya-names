import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "../../../src/design-system/ThemeToggle";
import { THEME_STORAGE_KEY } from "../../../src/design-system/theme";

function mockSystemTheme(dark: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(
      (query) =>
        ({
          matches: query === "(prefers-color-scheme: dark)" && dark,
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList,
    ),
  );
}

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("follows the system theme on first use", () => {
    mockSystemTheme(true);
    render(<ThemeToggle />);

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(screen.getByRole("button", { name: "切换为亮色主题" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("persists a manual theme selection", async () => {
    mockSystemTheme(false);
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button", { name: "切换为暗色主题" }));

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("prefers the stored theme over the system preference", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    mockSystemTheme(true);
    render(<ThemeToggle />);

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(screen.getByRole("button", { name: "切换为暗色主题" })).toBeVisible();
  });
});
