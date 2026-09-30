import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CandidateFunnelPage } from "../../src/features/funnel/CandidateFunnelPage";
import { FinalReport } from "../../src/features/finalization/FinalReport";

describe("user content rendering", () => {
  it("renders candidate text literally without creating executable markup", () => {
    const payload = '<img src=x onerror="window.__xss=1">';
    const { container } = render(
      <CandidateFunnelPage
        candidates={[
          {
            id: "xss",
            fullName: payload,
            pinyin: [],
            sourceType: "user_input",
            summary: "<script>window.__xss=1</script>",
            stage: "inbox",
            warnings: [],
          },
        ]}
        onFavorite={vi.fn()}
      />,
    );
    expect(screen.getByText(payload)).toBeVisible();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
  });

  it("escapes user content in the printable final report", () => {
    const payload = '<img src=x onerror="window.__xss=1">';
    const { container } = render(
      <FinalReport
        redactions={{}}
        report={{
          projectTitle: payload,
          selectedCandidateId: "c1",
          rationale: payload,
          privateData: { avoidCharacters: [] },
          folkloreEnabled: false,
          finalists: [
            {
              id: "c1",
              fullName: payload,
              pinyin: [],
              summary: payload,
              sources: [{ sourceId: "user", quote: payload }],
              warnings: [],
            },
          ],
        }}
      />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getAllByText(payload).length).toBeGreaterThan(0);
  });
});
