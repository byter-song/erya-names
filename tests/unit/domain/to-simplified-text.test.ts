import { describe, expect, it } from "vitest";
import mappingAsset from "../../../src/data/curated/traditional-to-simplified.json";
import { toSimplifiedText } from "../../../src/domain/candidate/toSimplifiedText";

describe("toSimplifiedText", () => {
  it("converts source text code point by code point and keeps other text", () => {
    expect(toSimplifiedText("詩言志，學而時習之。", mappingAsset.mappings)).toBe(
      "诗言志，学而时习之。",
    );
  });

  it("normalizes text before applying the persistent map", () => {
    expect(toSimplifiedText("臺灣", mappingAsset.mappings)).toBe("台湾");
  });
});
