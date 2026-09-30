import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FinalReport } from "../../../src/features/finalization/FinalReport";

const report = {
  projectTitle: "宋姓宝宝起名",
  selectedCandidateId: "c1",
  rationale: "出处可信，读音清朗。",
  privateData: { birthLocalDateTime: "2026-09-17T08:00", avoidCharacters: ["病"] },
  folkloreEnabled: true,
  finalists: [
    {
      id: "c1",
      fullName: "宋清扬",
      pinyin: ["sòng", "qīng", "yáng"],
      summary: "清秀明朗，神采飞扬。",
      sources: [{ sourceId: "shijing", work: "诗经·郑风", quote: "有美一人，清扬婉兮。" }],
      warnings: [],
      rating: 5,
      note: "全家最喜欢",
    },
  ],
};

describe("FinalReport", () => {
  it("renders the finalist evidence and final rationale", () => {
    render(<FinalReport report={report} redactions={{}} />);

    expect(screen.getByRole("heading", { name: "宋清扬" })).toBeVisible();
    expect(screen.getByText("有美一人，清扬婉兮。")).toBeVisible();
    expect(screen.getByText(/最终说明：出处可信，读音清朗。/)).toBeVisible();
    expect(screen.getByText(/备注：全家最喜欢/)).toBeVisible();
  });

  it("removes redacted values from the rendered DOM", () => {
    render(
      <FinalReport
        report={report}
        redactions={{ birthData: true, avoidCharacters: true, notes: true, folklore: true }}
      />,
    );

    expect(screen.queryByText("2026-09-17T08:00")).not.toBeInTheDocument();
    expect(screen.queryByText("病")).not.toBeInTheDocument();
    expect(screen.queryByText("全家最喜欢")).not.toBeInTheDocument();
    expect(screen.queryByText(/民俗参考/)).not.toBeInTheDocument();
  });
});
