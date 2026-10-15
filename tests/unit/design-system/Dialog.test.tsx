import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { Dialog } from "../../../src/design-system/primitives/Dialog";

it("cycles focus through visible controls without entering collapsed details", async () => {
  const user = userEvent.setup();
  render(
    <Dialog title="测试长内容" onClose={vi.fn()}>
      <button>保存</button>
      <details>
        <summary>更多</summary>
        <button>折叠中的操作</button>
      </details>
    </Dialog>,
  );
  await user.keyboard("{Shift>}{Tab}{/Shift}");
  expect(screen.getByText("更多")).toHaveFocus();
  await user.tab();
  expect(screen.getByRole("button", { name: "关闭" })).toHaveFocus();
});

it("closes with Escape if an async action temporarily lost browser focus", async () => {
  const user = userEvent.setup();
  const close = vi.fn();
  render(
    <Dialog title="保存失败后" onClose={close}>
      <button>重试</button>
    </Dialog>,
  );
  screen.getByRole("dialog").blur();
  await user.keyboard("{Escape}");
  expect(close).toHaveBeenCalledTimes(1);
});
