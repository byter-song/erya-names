import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OnboardingWizard } from "../../../../src/features/onboarding/OnboardingWizard";

describe("OnboardingWizard", () => {
  it("collects a four-step Song surname profile and completes onboarding", async () => {
    const onComplete = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<OnboardingWizard defaultSurname="宋" onComplete={onComplete} />);

    expect(screen.getByText("第 1 步，共 4 步")).toBeVisible();
    expect(screen.getByLabelText("方案名称")).toHaveValue("宋姓宝宝起名");
    expect(screen.getByLabelText("姓氏")).toHaveValue("宋");

    await user.click(screen.getByRole("button", { name: "下一步" }));
    await user.type(screen.getByLabelText("避字"), "病，殇");
    await user.click(screen.getByRole("button", { name: "下一步" }));
    await user.click(screen.getByLabelText("清朗自然"));
    await user.click(screen.getByRole("button", { name: "下一步" }));
    expect(screen.getByRole("checkbox", { name: "启用基础民俗参考" })).not.toBeChecked();
    await user.click(screen.getByRole("button", { name: "完成建档并生成姓名" }));

    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "宋姓宝宝起名",
        surname: "宋",
        avoidCharacters: ["病", "殇"],
        styleTags: ["清朗自然"],
        folklore: expect.objectContaining({ enabled: false }),
      }),
    );
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
});
