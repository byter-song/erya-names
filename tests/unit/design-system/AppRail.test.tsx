import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppRail, type AppRailItem } from "../../../src/design-system/layout/AppRail";

const items: AppRailItem[] = [
  { id: "overview", label: "方案概览", href: "/projects/project-1" },
  { id: "generate", label: "生成中心", href: "/projects/project-1/generate" },
];

describe("AppRail", () => {
  beforeEach(() => {
    localStorage.clear();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("renders a fixed expanded journey without decorative icons or a collapse control", () => {
    render(<AppRail activeId="generate" items={items} />);

    const navigation = screen.getByRole("navigation", { name: "方案工作区" });
    expect(navigation).toHaveStyle({ width: "220px" });
    expect(screen.getByRole("link", { name: "生成中心" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.queryByRole("button", { name: /收起导航|展开导航/ })).not.toBeInTheDocument();
    expect(screen.getByText("方案概览")).toBeVisible();
    expect(navigation).toHaveAttribute("data-active-step", "2");
    expect(screen.getByText("第 2 / 2 阶段")).toBeVisible();
    expect(screen.getByRole("link", { name: "生成中心" })).toHaveAttribute(
      "data-stage",
      "current",
    );
    expect(screen.getByRole("link", { name: "方案概览" })).toHaveAttribute(
      "data-stage",
      "available",
    );
    expect(
      within(navigation).queryByRole("button", { name: "切换为暗色主题" }),
    ).not.toBeInTheDocument();
  });

  it("ignores the removed collapse preference and stays expanded", () => {
    localStorage.setItem("erya-names:rail-expanded", "false");
    render(<AppRail activeId="overview" items={items} />);

    expect(screen.getByText("方案概览")).toBeVisible();
  });

  it("uses client navigation for an ordinary click", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<AppRail activeId="overview" items={items} onNavigate={onNavigate} />);

    await user.click(screen.getByRole("link", { name: "生成中心" }));

    expect(onNavigate).toHaveBeenCalledOnce();
    expect(onNavigate).toHaveBeenCalledWith("/projects/project-1/generate");
  });

  it("keeps the active journey item visible and blocks unavailable stages", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <AppRail
        activeId="generate"
        items={[
          items[0]!,
          items[1]!,
          { id: "compare", label: "候选对比", href: "/compare", disabled: true },
        ]}
        onNavigate={onNavigate}
      />,
    );

    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
      block: "nearest",
      inline: "center",
    });
    const disabled = screen.getByRole("link", { name: "候选对比" });
    expect(disabled).toHaveAttribute("aria-disabled", "true");
    await user.click(disabled);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("renders business availability without inferring completion from URL order", () => {
    render(
      <AppRail
        activeId="basic"
        items={[
          { id: "inbox", label: "灵感池", href: "#inbox", availability: "completed" },
          { id: "basic", label: "基础候选", href: "#basic", availability: "available" },
          { id: "folklore", label: "民俗候选", href: "#folklore", availability: "optional" },
          { id: "compare", label: "重点候选", href: "/compare", availability: "blocked" },
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: "灵感池" })).toHaveAttribute(
      "data-stage",
      "completed",
    );
    expect(screen.getByRole("link", { name: "基础候选" })).toHaveAttribute(
      "data-stage",
      "current",
    );
    expect(screen.getByRole("link", { name: "民俗候选" })).toHaveAttribute(
      "data-stage",
      "optional",
    );
    expect(screen.getByRole("link", { name: "重点候选" })).toHaveAttribute(
      "data-stage",
      "blocked",
    );
  });
});
