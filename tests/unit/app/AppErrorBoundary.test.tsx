import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppErrorBoundary } from "../../../src/app/AppErrorBoundary";

describe("AppErrorBoundary", () => {
  it("offers retry, project center, and a sanitized diagnostic download", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<AppErrorBoundary error={new Error("private-name: 宋清扬")} onRetry={onRetry} />);

    expect(screen.getByRole("heading", { name: "应用暂时无法继续" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "重试" }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "返回方案中心" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("button", { name: "导出脱敏诊断" })).toBeVisible();
    expect(screen.queryByText(/宋清扬/)).not.toBeInTheDocument();
  });
});
