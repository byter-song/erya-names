import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createStartupScreen } from "../../../src/app/startupScreen";

describe("startup screen", () => {
  it("creates an accessible brush-opening status without remote assets", () => {
    const controller = createStartupScreen();
    const screen = controller.element;

    expect(screen).toHaveClass("startup-screen");
    expect(screen).toHaveAttribute("role", "status");
    expect(screen).toHaveAttribute("aria-live", "polite");
    expect(screen.querySelector(".startup-screen__mark")).toHaveTextContent("雅");
    expect(screen.querySelector("progress")).toHaveAttribute("aria-label", "资料载入进度");
    controller.setProgress(0.5);
    expect(screen.querySelector("progress")?.value).toBe(0.5);
    expect(screen.textContent).toContain("展卷寻名");
  });

  it("preserves recovery actions when startup fails", async () => {
    const retry = vi.fn();
    const browse = vi.fn();
    const controller = createStartupScreen();
    const screen = controller.element;
    document.body.append(screen);

    controller.fail({ onRetry: retry, onBrowse: browse });
    const user = userEvent.setup();
    await user.click(document.querySelector<HTMLButtonElement>("[data-action='retry']")!);
    await user.click(document.querySelector<HTMLButtonElement>("[data-action='browse']")!);

    expect(screen).toHaveClass("startup-screen--error");
    expect(screen.textContent).toContain("起名资料暂时未能载入");
    expect(retry).toHaveBeenCalledOnce();
    expect(browse).toHaveBeenCalledOnce();
  });
});
