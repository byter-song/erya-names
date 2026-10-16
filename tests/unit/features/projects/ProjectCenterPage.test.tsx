import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ProjectSummary } from "../../../../src/application/models/ProjectSummary";
import { ProjectCenterPage } from "../../../../src/features/projects/ProjectCenterPage";

function projectSummary(overrides: Partial<ProjectSummary> = {}): ProjectSummary {
  return {
    id: "project-1",
    title: "宋姓宝宝起名",
    surname: "宋",
    stage: "naming",
    status: "active",
    poolCounts: { inspiration: 16, candidate: 5, selected: 2, excluded: 1 },
    totalCandidateCount: 24,
    updatedAt: "2026-10-16T12:00:00.000Z",
    ...overrides,
  };
}

describe("ProjectCenterPage", () => {
  it("guides a first-time user to create a naming project", async () => {
    const onCreate = vi.fn();
    const user = userEvent.setup();
    render(<ProjectCenterPage onCreate={onCreate} projects={[]} />);

    expect(screen.getByRole("heading", { name: "铺开第一卷" })).toBeVisible();
    await user.click(screen.getAllByRole("button", { name: "展新卷 · 新建方案" })[0]!);

    expect(onCreate).toHaveBeenCalledOnce();
  });

  it("shows the version name, updated time, and all four pool counts", () => {
    render(<ProjectCenterPage onCreate={vi.fn()} projects={[projectSummary()]} />);

    expect(screen.getByRole("heading", { name: "最近展卷" })).toBeVisible();
    expect(screen.getByText("宋姓宝宝起名")).toBeVisible();
    expect(screen.getByText("灵感 16")).toBeVisible();
    expect(screen.getByText("候选 5")).toBeVisible();
    expect(screen.getByText("精选 2")).toBeVisible();
    expect(screen.getByText("排除 1")).toBeVisible();
    expect(screen.getByRole("link", { name: "继续方案" })).toHaveAttribute(
      "href",
      "/projects/project-1/names",
    );
  });

  it("submits a renamed version with Enter and uses the current optimistic-lock value", async () => {
    const user = userEvent.setup();
    const onRename = vi.fn().mockResolvedValue({
      title: "宋姓 · 清朗版",
      updatedAt: "2026-10-16T13:00:00.000Z",
    });
    render(
      <ProjectCenterPage
        onCreate={vi.fn()}
        onRename={onRename}
        projects={[projectSummary()]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "重命名方案宋姓宝宝起名" }));
    const input = screen.getByRole("textbox", { name: "方案版本名" });
    await user.clear(input);
    await user.type(input, "宋姓 · 清朗版{Enter}");

    await waitFor(() =>
      expect(onRename).toHaveBeenCalledWith({
        projectId: "project-1",
        title: "宋姓 · 清朗版",
        expectedUpdatedAt: "2026-10-16T12:00:00.000Z",
      }),
    );
    expect(await screen.findByRole("heading", { name: "宋姓 · 清朗版" })).toBeVisible();
  });

  it("keeps the rename editor open and explains an optimistic-lock conflict", async () => {
    const user = userEvent.setup();
    const onRename = vi.fn().mockRejectedValue(new Error("project-stale"));
    render(
      <ProjectCenterPage
        onCreate={vi.fn()}
        onRename={onRename}
        projects={[projectSummary()]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "重命名方案宋姓宝宝起名" }));
    await user.keyboard("{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "方案已在其他位置更新，请刷新后重试",
    );
    expect(screen.getByRole("textbox", { name: "方案版本名" })).toBeVisible();
  });

  it("copies configuration under a new version name and opens the independent project", async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn().mockResolvedValue({ projectId: "project-copy" });
    const onOpen = vi.fn();
    render(
      <ProjectCenterPage
        onCopy={onCopy}
        onCreate={vi.fn()}
        onOpen={onOpen}
        projects={[projectSummary()]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "复制配置宋姓宝宝起名" }));
    const input = screen.getByRole("textbox", { name: "新版本名" });
    await user.clear(input);
    await user.type(input, "宋姓 · 民俗版{Enter}");

    await waitFor(() =>
      expect(onCopy).toHaveBeenCalledWith({
        sourceProjectId: "project-1",
        title: "宋姓 · 民俗版",
      }),
    );
    expect(onOpen).toHaveBeenCalledWith("/projects/project-copy/config");
  });

  it("shows a completed project after finalization", () => {
    render(
      <ProjectCenterPage
        onCreate={vi.fn()}
        projects={[projectSummary({ stage: "export", status: "completed" })]}
      />,
    );
    expect(screen.getByText("已完成")).toBeVisible();
    expect(screen.getByRole("link", { name: "继续方案" })).toHaveAttribute(
      "href",
      "/projects/project-1/export",
    );
  });

  it("confirms before deleting a project", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(
      <ProjectCenterPage
        onCreate={vi.fn()}
        onDelete={onDelete}
        projects={[projectSummary()]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "删除方案宋姓宝宝起名" }));
    expect(screen.getByRole("dialog", { name: "删除起名方案" })).toBeVisible();
    expect(screen.getByText(/统一配置、候选姓名、四池状态、评分证据和评价/)).toBeVisible();
    expect(onDelete).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "确认删除" }));
    expect(onDelete).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledWith("project-1");
  });
});
