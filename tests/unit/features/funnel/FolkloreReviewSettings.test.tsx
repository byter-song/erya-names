import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FolkloreReviewSettings } from "../../../../src/features/funnel/FolkloreReviewSettings";
import { namingProfileFixture } from "../../../fixtures/namingProfile";

describe("FolkloreReviewSettings", () => {
  it("saves folklore preferences only from the folklore review stage", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <FolkloreReviewSettings
        candidateCount={3}
        profile={namingProfileFixture()}
        onSave={save}
      />,
    );

    expect(screen.getByRole("region", { name: "民俗参考设置" })).toHaveTextContent(
      "当前有 3个名字等待民俗参考",
    );
    await user.click(screen.getByRole("checkbox", { name: "采用传统民俗参考" }));
    await user.click(screen.getByRole("checkbox", { name: "水" }));
    await user.click(screen.getByRole("checkbox", { name: "用指定五行意象排序当前民俗候选" }));
    await user.click(screen.getByRole("button", { name: "保存并重新评估民俗候选" }));

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
          usefulElements: ["water"],
          includeInRanking: true,
          timeZone: "Asia/Shanghai",
        }),
      ),
    );
    expect(screen.getByRole("status")).toHaveTextContent("民俗设置和当前候选结果已更新");
  });
});
