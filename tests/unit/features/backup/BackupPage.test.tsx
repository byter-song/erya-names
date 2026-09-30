import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BackupPage } from "../../../../src/features/backup/BackupPage";

describe("BackupPage", () => {
  it("downloads a plain backup and can request password encryption", async () => {
    const exportBackup = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<BackupPage onExport={exportBackup} projectTitle="宋姓宝宝起名" />);

    await user.click(screen.getByRole("button", { name: "下载 JSON 备份" }));
    expect(exportBackup).toHaveBeenLastCalledWith(undefined);

    await user.click(screen.getByLabelText("使用密码加密"));
    await user.type(screen.getByLabelText("备份密码"), "safe password");
    await user.click(screen.getByRole("button", { name: "下载加密备份" }));
    expect(exportBackup).toHaveBeenLastCalledWith("safe password");
  });
});
