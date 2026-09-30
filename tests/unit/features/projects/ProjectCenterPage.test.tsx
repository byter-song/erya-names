import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProjectCenterPage } from "../../../../src/features/projects/ProjectCenterPage";

describe("ProjectCenterPage", () => {
  it("guides a first-time user to create a naming project", async () => {
    const onCreate = vi.fn();
    const user = userEvent.setup();
    render(<ProjectCenterPage onCreate={onCreate} projects={[]} />);

    expect(screen.getByRole("heading", { name: "开始第一个起名方案" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "新建起名方案" }));

    expect(onCreate).toHaveBeenCalledOnce();
  });

  it("shows resumable progress for existing projects", () => {
    const onOpen = vi.fn();
    render(
      <ProjectCenterPage
        onCreate={vi.fn()}
        onOpen={onOpen}
        projects={[
          {
            id: "project-1",
            title: "宋姓宝宝起名",
            surname: "宋",
            stage: "generation",
            status: "active",
            candidateCount: 24,
            favoriteCount: 5,
            finalistCount: 2,
            updatedAt: "2026-09-17T12:00:00.000Z",
          },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "继续最近方案" })).toBeVisible();
    expect(screen.getByText("宋姓宝宝起名")).toBeVisible();
    expect(screen.getByText("候选 24")).toBeVisible();
    expect(screen.getByText("收藏 5")).toBeVisible();
    expect(screen.getByText("最终 2 / 5")).toBeVisible();
    expect(screen.getByRole("link", { name: "继续方案" })).toHaveAttribute(
      "href",
      "/projects/project-1/generate",
    );
  });

  it("shows a completed project after finalization", () => {
    render(
      <ProjectCenterPage
        onCreate={vi.fn()}
        projects={[
          {
            id: "project-1",
            title: "宋姓宝宝起名",
            surname: "宋",
            stage: "finalization",
            status: "completed",
            candidateCount: 24,
            favoriteCount: 5,
            finalistCount: 3,
            updatedAt: "2026-09-17T12:00:00.000Z",
          },
        ]}
      />,
    );
    expect(screen.getByText("已完成")).toBeVisible();
    expect(screen.getByRole("link", { name: "继续方案" })).toHaveAttribute(
      "href",
      "/projects/project-1/finalize",
    );
  });

  it("confirms before deleting a project", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(
      <ProjectCenterPage
        onCreate={vi.fn()}
        onDelete={onDelete}
        projects={[
          {
            id: "project-1",
            title: "宋姓宝宝起名",
            surname: "宋",
            stage: "generation",
            status: "active",
            candidateCount: 24,
            favoriteCount: 5,
            finalistCount: 2,
            updatedAt: "2026-09-17T12:00:00.000Z",
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "删除方案宋姓宝宝起名" }));
    expect(screen.getByRole("dialog", { name: "删除起名方案" })).toBeVisible();
    expect(screen.getByText(/候选姓名、评价、对比记录和最终定稿/)).toBeVisible();
    expect(onDelete).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "确认删除" }));
    expect(onDelete).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledWith("project-1");
  });
});
