import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InkScene } from "../../../src/design-system/ink/InkScene";

describe("InkScene", () => {
  it("keeps decorative brush layers outside the content semantics", () => {
    render(
      <InkScene>
        <h1>生成中心</h1>
      </InkScene>,
    );

    expect(screen.getByRole("heading", { name: "生成中心" })).toBeVisible();
    expect(document.querySelector(".ink-scene__ambient")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(document.querySelector(".ink-scene__landscape")).not.toBeInTheDocument();
  });

  it("does not mount pointer-driven canvas or motion controls", () => {
    const addEventListener = vi.spyOn(window, "addEventListener");
    render(<InkScene>内容</InkScene>);

    expect(screen.queryByTestId("gold-ink-canvas")).not.toBeInTheDocument();
    expect(screen.queryByTestId("gold-ink-splash-canvas")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /水墨动效/ })).not.toBeInTheDocument();
    expect(
      addEventListener.mock.calls.some(([eventName]) =>
        ["pointermove", "pointerdown"].includes(String(eventName)),
      ),
    ).toBe(false);
    addEventListener.mockRestore();
  });
});
