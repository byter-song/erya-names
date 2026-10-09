import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { GenerationCenterPage } from "../../../../src/features/generation/GenerationCenterPage";
describe("generation workspace", () => {
  it("generates a fixed batch without exposing the quantity control", async () => {
    const generate = vi.fn().mockResolvedValue({ candidateCount: 9 });
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
    expect(screen.queryByLabelText("每批生成数量")).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("典故比例"), "1");
    await user.click(screen.getByRole("button", { name: "生成一批" }));
    await waitFor(() =>
      expect(generate).toHaveBeenCalledWith({ requestedCount: 9, allusionRatio: 1 }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("新一批灵感已生成");
    expect(screen.queryByText(/9 个名字/)).not.toBeInTheDocument();
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
    await user.click(screen.getByRole("button", { name: "生成一批" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("保存失败");
    await user.click(screen.getByRole("button", { name: "生成一批" }));
    expect(await screen.findByRole("status")).toHaveTextContent("这组条件暂时没有新的名字");
  });

  it("shares one generation state with the inline controls and repeat action", async () => {
    const generate = vi.fn().mockResolvedValue({ candidateCount: 9, batchId: "batch-new" });
    const user = userEvent.setup();

    render(
      <GenerationCenterPage
        profile={{ surname: "宋", givenNameLength: 2, styleTags: [] }}
        datasetVersion="personal"
        generate={generate}
      >
        {({ generationControls, onGenerateMore, latestBatchId }) => (
          <section>
            {generationControls}
            <output aria-label="最新批次">{latestBatchId ?? "尚未生成"}</output>
            <button onClick={() => void onGenerateMore()} type="button">
              在列表底部再生成
            </button>
          </section>
        )}
      </GenerationCenterPage>,
    );

    await user.click(screen.getByRole("button", { name: "生成一批" }));
    await waitFor(() =>
      expect(screen.getByLabelText("最新批次")).toHaveTextContent("batch-new"),
    );
    await user.click(screen.getByRole("button", { name: "在列表底部再生成" }));
    await waitFor(() => expect(generate).toHaveBeenCalledTimes(2));
  });
});
