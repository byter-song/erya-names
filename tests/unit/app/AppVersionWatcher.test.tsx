import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppVersionWatcher } from "../../../src/features/app-update/AppVersionWatcher";

describe("AppVersionWatcher", () => {
  it("shows a refresh prompt when a compatible static version is newer", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          appVersion: "0.2.1",
          buildHash: "new-build",
          minimumDatabaseVersion: 1,
          maximumDatabaseVersion: 1,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    render(
      <AppVersionWatcher
        currentVersion="0.2.0"
        databaseVersion={1}
        fetcher={fetcher}
        refresh={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText("新版本 0.2.1 已发布")).toBeVisible());
  });

  it("stays silent when the version check is unavailable", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("network unavailable"));

    render(
      <AppVersionWatcher
        currentVersion="0.2.0"
        databaseVersion={1}
        fetcher={fetcher}
        refresh={vi.fn()}
      />,
    );

    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    expect(screen.queryByLabelText("应用更新")).not.toBeInTheDocument();
  });

  it("blocks refresh and explains recovery when the new release is incompatible", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          appVersion: "0.3.0",
          buildHash: "new-build",
          minimumDatabaseVersion: 2,
          maximumDatabaseVersion: 2,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    render(
      <AppVersionWatcher
        currentVersion="0.2.0"
        databaseVersion={1}
        fetcher={fetcher}
        refresh={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText(/暂不兼容当前本地数据/)).toBeVisible());
    expect(screen.queryByRole("button", { name: "备份后刷新" })).not.toBeInTheDocument();
  });
});
