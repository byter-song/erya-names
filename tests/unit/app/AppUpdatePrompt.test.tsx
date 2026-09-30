import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppUpdatePrompt } from "../../../src/features/app-update/AppUpdatePrompt";

describe("AppUpdatePrompt", () => {
  it("waits for explicit confirmation before refreshing to a static release", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AppUpdatePrompt currentVersion="0.2.0" latestVersion="0.2.1" refresh={refresh} />);

    expect(screen.getByText("新版本 0.2.1 已发布")).toBeVisible();
    expect(refresh).not.toHaveBeenCalled();

    expect(screen.getByText(/建议先下载项目备份/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "备份后刷新" }));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("stays on the current release when durable writes cannot be flushed", async () => {
    const user = userEvent.setup();
    render(
      <AppUpdatePrompt
        currentVersion="0.2.0"
        latestVersion="0.2.1"
        refresh={vi.fn().mockRejectedValue(new Error("draft-write-failed"))}
      />,
    );

    await user.click(screen.getByRole("button", { name: "备份后刷新" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("draft-write-failed");
  });

  it("does not render when the browser has the latest release", () => {
    render(<AppUpdatePrompt currentVersion="0.2.0" latestVersion="0.2.0" refresh={vi.fn()} />);
    expect(screen.queryByText(/新版本/)).not.toBeInTheDocument();
  });
});
