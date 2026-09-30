import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FinalizationPage } from "../../../../src/features/finalization/FinalizationPage";

describe("FinalizationPage", () => {
  it("records the selected final name and rationale", async () => {
    const finalize = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <FinalizationPage
        candidates={[
          { id: "c1", fullName: "宋清扬", summary: "清秀明朗", rating: 5 },
          { id: "c2", fullName: "宋知远", summary: "志向高远", rating: 4 },
          { id: "c3", fullName: "宋嘉树", summary: "坚定成长" },
        ]}
        onFinalize={finalize}
      />,
    );

    await user.click(screen.getByLabelText("选择宋清扬"));
    await user.type(screen.getByLabelText("最终选择说明"), "出处可信，读音清朗。");
    await user.click(screen.getByRole("button", { name: "保存最终选择" }));

    expect(finalize).toHaveBeenCalledWith({
      selectedCandidateId: "c1",
      rationale: "出处可信，读音清朗。",
    });
  });

  it("shows a saved final decision after reload", () => {
    render(
      <FinalizationPage
        candidates={[
          { id: "c1", fullName: "宋清扬", summary: "清秀明朗", rating: 5 },
          { id: "c2", fullName: "宋知远", summary: "志向高远" },
          { id: "c3", fullName: "宋嘉树", summary: "坚定成长" },
        ]}
        initialDecision={{ selectedCandidateId: "c1", rationale: "出处可信" }}
        onFinalize={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("选择宋清扬")).toBeChecked();
    expect(screen.getByLabelText("最终选择说明")).toHaveValue("出处可信");
    expect(screen.getByRole("status")).toHaveTextContent("最终选择已保存：宋清扬");
  });

  it("hydrates the form when the saved decision arrives asynchronously", () => {
    const finalists = [
      { id: "c1", fullName: "宋清扬", summary: "清秀明朗", rating: 5 },
      { id: "c2", fullName: "宋知远", summary: "志向高远" },
      { id: "c3", fullName: "宋嘉树", summary: "坚定成长" },
    ];
    const { rerender } = render(<FinalizationPage candidates={[]} onFinalize={vi.fn()} />);

    rerender(
      <FinalizationPage
        candidates={finalists}
        initialDecision={{ selectedCandidateId: "c1", rationale: "出处可信" }}
        onFinalize={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("选择宋清扬")).toBeChecked();
    expect(screen.getByLabelText("最终选择说明")).toHaveValue("出处可信");
  });
});
