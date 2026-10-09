import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OnboardingWizard } from "../../../../src/features/onboarding/OnboardingWizard";
import { ONBOARDING_DRAFT_KEY } from "../../../../src/infrastructure/persistence/LocalDraftWriter";

describe("OnboardingWizard", () => {
  it("collects a three-step Song surname profile and leaves folklore for the later stage", async () => {
    const onComplete = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<OnboardingWizard defaultSurname="宋" onComplete={onComplete} />);

    expect(screen.getByText("第 1 步，共 3 步")).toBeVisible();
    expect(screen.getByLabelText("方案名称")).toHaveValue("宋姓宝宝起名");
    expect(screen.getByLabelText("姓氏")).toHaveValue("宋");

    await user.click(screen.getByRole("button", { name: "下一步" }));
    await user.click(screen.getByLabelText("有", { exact: true }));
    await user.type(screen.getByLabelText("避字"), "病，殇");
    await user.click(screen.getByRole("button", { name: "下一步" }));
    await user.click(screen.getByLabelText("清朗自然"));
    expect(screen.queryByText(/民俗/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "完成建档，开始选名" }));

    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "宋姓宝宝起名",
        surname: "宋",
        childGender: "unknown",
        constraintKnowledge: "present",
        avoidCharacters: ["病", "殇"],
        styleTags: ["清朗自然"],
        folklore: expect.objectContaining({ enabled: false }),
      }),
    );
  });

  it("validates the current step before advancing and identifies invalid fields", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard defaultSurname="宋" onComplete={vi.fn()} />);

    await user.clear(screen.getByLabelText("方案名称"));
    await user.clear(screen.getByLabelText("姓氏"));
    await user.click(screen.getByRole("button", { name: "下一步" }));

    expect(screen.getByText("第 1 步，共 3 步")).toBeVisible();
    expect(screen.getByText("请填写方案名称")).toHaveAttribute("role", "alert");
    expect(screen.getByLabelText("方案名称")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("姓氏")).toHaveAttribute("aria-invalid", "true");
  });

  it("starts without assuming a family surname and derives the untouched title", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard onComplete={vi.fn()} />);

    expect(screen.getByLabelText("方案名称")).toHaveValue("宝宝起名");
    expect(screen.getByLabelText("姓氏")).toHaveValue("");
    await user.type(screen.getByLabelText("姓氏"), "陈");
    expect(screen.getByLabelText("方案名称")).toHaveValue("陈姓宝宝起名");
  });

  it("restores a durable onboarding draft after remount", async () => {
    const user = userEvent.setup();
    const first = render(<OnboardingWizard defaultSurname="宋" onComplete={vi.fn()} />);
    await user.clear(screen.getByLabelText("方案名称"));
    await user.type(screen.getByLabelText("方案名称"), "宋氏书香起名");
    first.unmount();

    render(<OnboardingWizard defaultSurname="宋" onComplete={vi.fn()} />);
    expect(screen.getByLabelText("方案名称")).toHaveValue("宋氏书香起名");
  });

  it("keeps sensitive family fields out of the 24-hour LocalStorage draft", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard defaultSurname="宋" onComplete={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "下一步" }));
    await user.click(screen.getByLabelText("有", { exact: true }));
    await user.type(screen.getByLabelText("避字"), "克，玲，龙");
    await user.type(screen.getByLabelText("亲属姓名"), "测试亲属");

    const stored = localStorage.getItem(ONBOARDING_DRAFT_KEY) ?? "";
    expect(stored).toContain('"draftSchemaVersion":2');
    expect(stored).not.toContain("克");
    expect(stored).not.toContain("玲");
    expect(stored).not.toContain("测试亲属");
    expect(stored).not.toContain("birthLocalDateTime");
  });

  it("lets a default user start naming directly after confirming no family rules", async () => {
    const onComplete = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<OnboardingWizard defaultSurname="宋" onComplete={onComplete} />);

    await user.click(screen.getByRole("button", { name: "下一步" }));
    await user.click(screen.getByLabelText("没有", { exact: true }));
    await user.click(screen.getByRole("button", { name: "使用默认设置，开始选名" }));

    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        surname: "宋",
        constraintKnowledge: "none",
        styleTags: [],
        folklore: expect.objectContaining({ enabled: false }),
      }),
    );
  });
});
