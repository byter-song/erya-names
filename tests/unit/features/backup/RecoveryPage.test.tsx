import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RecoveryPage } from "../../../../src/features/backup/RecoveryPage";

describe("RecoveryPage", () => {
  it("previews a conflict and requires an explicit restore strategy", async () => {
    const preview = vi.fn().mockResolvedValue({
      projectId: "project-song",
      projectTitle: "宋姓宝宝起名",
      conflict: "project-id",
      counts: { candidates: 12, finalDecisions: 1 },
    });
    const restore = vi.fn().mockResolvedValue({ projectId: "project-song-copy" });
    const user = userEvent.setup();
    render(<RecoveryPage onPreview={preview} onRestore={restore} />);

    const file = new File(["{}"], "backup.json", { type: "application/json" });
    await user.upload(screen.getByLabelText("选择备份文件"), file);
    expect(await screen.findByText("检测到同 ID 方案")).toBeVisible();
    expect(screen.getByText("候选 12 条")).toBeVisible();
    expect(screen.getByRole("button", { name: "确认恢复" })).toBeDisabled();

    await user.selectOptions(screen.getByLabelText("冲突处理方式"), "import-copy");
    await user.click(screen.getByRole("button", { name: "确认恢复" }));
    expect(restore).toHaveBeenCalledWith(file, "import-copy", undefined);
  });

  it("shows a recoverable error when backup preview fails", async () => {
    const preview = vi.fn().mockRejectedValue(new Error("备份文件格式无效"));
    const user = userEvent.setup();
    render(
      <RecoveryPage
        onPreview={preview}
        onRestore={vi.fn().mockResolvedValue({ projectId: "unused" })}
      />,
    );

    await user.upload(
      screen.getByLabelText("选择备份文件"),
      new File(["{}"], "broken.json", { type: "application/json" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("备份文件格式无效");
    expect(screen.queryByRole("region", { name: "恢复预览" })).not.toBeInTheDocument();
  });

  it.each([
    ["encrypted-backup-password-required", "无法解密备份"],
    ["unsupported schemaVersion", "备份版本不受支持"],
    ["checksum mismatch", "备份完整性校验失败"],
  ])("maps %s to a user-facing recovery message", async (failure, message) => {
    const user = userEvent.setup();
    render(
      <RecoveryPage
        onPreview={vi.fn().mockRejectedValue(new Error(failure))}
        onRestore={vi.fn().mockResolvedValue({ projectId: "unused" })}
      />,
    );

    await user.upload(
      screen.getByLabelText("选择备份文件"),
      new File(["{}"], "backup.json", { type: "application/json" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  });
});
