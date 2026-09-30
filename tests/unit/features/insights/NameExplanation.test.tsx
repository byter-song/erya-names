import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import devBundle from "../../../../src/data/curated/dev-bundle.json";
import { initializeRuntimeBundle } from "../../../../src/data/activeRuntimeBundle";
import { NameExplanation } from "../../../../src/features/insights/NameExplanation";
import type { CandidateFunnelItem } from "../../../../src/application/models/CandidateFunnelItem";

const candidate: CandidateFunnelItem = {
  id: "candidate-wang-anshi",
  givenName: "安石",
  fullName: "王安石",
  pinyin: ["ān", "shí"],
  sourceType: "user_input",
  summary: "手工加入的名字",
  stage: "favorite",
  warnings: [],
};

afterEach(() => {
  initializeRuntimeBundle(devBundle);
});

describe("NameExplanation person usage", () => {
  it("shows an exact historical-name match with a neutral disclaimer", () => {
    initializeRuntimeBundle({
      ...devBundle,
      personUsages: [
        {
          id: "person:Q319618",
          name: "王安石",
          period: "北宋（1021—1086）",
          identityType: "historical_person",
          description: "北宋政治家、文学家、思想家。",
          sourceRefs: [
            {
              sourceId: "wikidata-person-usage",
              location: "Wikidata Q319618",
              url: "https://www.wikidata.org/wiki/Q319618",
            },
          ],
          reviewStatus: "source_checked",
          checkedAt: "2026-09-30",
        },
      ],
    });

    render(<NameExplanation candidate={candidate} />);

    expect(screen.getByRole("heading", { name: "历史用名参考" })).toBeVisible();
    expect(screen.getByText(/仅表示历史上存在完整同名记录/)).toHaveTextContent(
      "不参与评分和排序",
    );
    expect(screen.getByText(/北宋（1021—1086） · 历史人物/)).toBeVisible();
    expect(screen.getByRole("link", { name: "核对记录 ↗" })).toHaveAttribute(
      "href",
      "https://www.wikidata.org/wiki/Q319618",
    );
  });

  it("does not show a partial-name match", () => {
    initializeRuntimeBundle({
      ...devBundle,
      personUsages: [
        {
          id: "person:Q319618",
          name: "王安石",
          period: "北宋（1021—1086）",
          identityType: "historical_person",
          description: "北宋政治家、文学家、思想家。",
          sourceRefs: [{ sourceId: "wikidata-person-usage", location: "Wikidata Q319618" }],
          reviewStatus: "source_checked",
          checkedAt: "2026-09-30",
        },
      ],
    });

    render(<NameExplanation candidate={{ ...candidate, fullName: "安石" }} />);

    expect(screen.queryByRole("heading", { name: "历史用名参考" })).not.toBeInTheDocument();
  });
});
