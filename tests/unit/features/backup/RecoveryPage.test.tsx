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
});
