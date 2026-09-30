import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AddManualCandidateDialog } from "../../../../src/features/funnel/AddManualCandidateDialog";

describe("AddManualCandidateDialog", () => {
  it("collects a full name, user source and meaning", async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AddManualCandidateDialog onAdd={add} />);
    await user.click(screen.getByRole("button", { name: "手工添加姓名" }));
    await user.type(screen.getByLabelText("完整姓名"), "宋泽谦");
    await user.type(screen.getByLabelText("来源说明"), "家人提议");
    await user.type(screen.getByLabelText("释义"), "温润谦和");
    await user.click(screen.getByRole("button", { name: "保存手工候选" }));
    expect(add).toHaveBeenCalledWith({
      fullName: "宋泽谦",
      userSource: "家人提议",
      meaning: "温润谦和",
    });
  });

  it("moves focus into the dialog and restores the trigger on close", async () => {
    const user = userEvent.setup();
    render(<AddManualCandidateDialog onAdd={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "手工添加姓名" });
    trigger.focus();
    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "手工添加候选" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(screen.getByRole("button", { name: "手工添加姓名" })).toHaveFocus();
  });

  it("closes with Escape and restores focus", async () => {
    const user = userEvent.setup();
    render(<AddManualCandidateDialog onAdd={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "手工添加姓名" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "手工添加姓名" })).toHaveFocus();
  });
});
