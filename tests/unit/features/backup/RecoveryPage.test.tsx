import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RecoveryPage } from "../../../../src/features/backup/RecoveryPage";

describe("RecoveryPage", () => {
  it("previews a conflict and defaults recovery to a fresh project id", async () => {
    const preview = vi.fn().mockResolvedValue({
      format: "erya-names-v2-project-backup",
      schemaVersion: 1,
      projectId: "project-song",
      projectTitle: "宋姓宝宝起名",
      exportedAt: "2026-10-16T10:00:00.000Z",
      conflict: "project-id",
      counts: { candidates: 12, candidateScores: 12, ruleEvidence: 36 },
      poolCounts: { inspiration: 4, candidate: 3, selected: 4, excluded: 1 },
    });
    const restore = vi
      .fn()
      .mockResolvedValue({ projectId: "project-song-copy", action: "imported" });
    const user = userEvent.setup();
    render(<RecoveryPage onPreview={preview} onRestore={restore} />);

    const file = new File(["{}"], "backup.json", { type: "application/json" });
    await user.upload(screen.getByLabelText("选择备份文件"), file);
    expect(await screen.findByText(/检测到同 ID 方案/)).toBeVisible();
    expect(screen.getByText("候选 12 条")).toBeVisible();
    expect(screen.getByRole("region", { name: "恢复预览" })).toHaveTextContent(
      /精选\s*4\s*条.*排除\s*1\s*条.*评分\s*12\s*条.*证据\s*36\s*条/,
    );
    expect(screen.getByRole("button", { name: "确认恢复" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "确认恢复" }));
    expect(restore).toHaveBeenCalledWith(file, "import-copy", undefined);
    expect(await screen.findByRole("status")).toHaveTextContent("project-song-copy");
  });

  it("shows a recoverable error when backup preview fails", async () => {
    const preview = vi.fn().mockRejectedValue(new Error("备份文件格式无效"));
    const user = userEvent.setup();
    render(
      <RecoveryPage
        onPreview={preview}
        onRestore={vi.fn().mockResolvedValue({ projectId: "unused", action: "imported" })}
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
    ["unsupported-format", "不支持的备份格式（unsupported-format）"],
    ["invalid-payload", "备份内容不完整"],
    ["invalid-checksum", "备份完整性校验失败"],
  ])("maps %s to a user-facing recovery message", async (failure, message) => {
    const user = userEvent.setup();
    render(
      <RecoveryPage
        onPreview={vi.fn().mockRejectedValue(new Error(failure))}
        onRestore={vi.fn().mockResolvedValue({ projectId: "unused", action: "imported" })}
      />,
    );

    await user.upload(
      screen.getByLabelText("选择备份文件"),
      new File(["{}"], "backup.json", { type: "application/json" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  });
});
