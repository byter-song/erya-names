import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { GenerationCenterPage } from "../../../../src/features/generation/GenerationCenterPage";
describe("generation workspace", () => {
  it("lets a family select batch size and direction and keeps results on the same page", async () => {
    const generate = vi.fn().mockResolvedValue({ candidateCount: 24 });
    const user = userEvent.setup();
    render(
      <GenerationCenterPage
        profile={{ surname: "宋", givenNameLength: 2, styleTags: [] }}
        datasetVersion="personal"
        generate={generate}
      >
        <p>同页灵感池</p>
      </GenerationCenterPage>,
    );
    await user.selectOptions(screen.getByLabelText("每批生成数量"), "24");
    await user.selectOptions(screen.getByLabelText("典故比例"), "1");
    await user.click(screen.getByRole("button", { name: "生成 24 个名字" }));
    await waitFor(() =>
      expect(generate).toHaveBeenCalledWith({ requestedCount: 24, allusionRatio: 1 }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("本批已生成 24 个名字");
    expect(screen.getByText("同页灵感池")).toBeVisible();
  });
  it("explains exhaustion and recovers from generation errors without leaving the page", async () => {
    const generate = vi
      .fn()
      .mockRejectedValueOnce(new Error("保存失败"))
      .mockResolvedValueOnce({ candidateCount: 0 });
    const user = userEvent.setup();
    render(
      <GenerationCenterPage
        profile={{ surname: "宋", givenNameLength: 2, styleTags: [] }}
        datasetVersion="personal"
        generate={generate}
      />,
    );
    await user.click(screen.getByRole("button", { name: "生成 48 个名字" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("保存失败");
    await user.click(screen.getByRole("button", { name: "生成 48 个名字" }));
    expect(await screen.findByRole("status")).toHaveTextContent("这组条件暂时没有新的名字");
  });
});
