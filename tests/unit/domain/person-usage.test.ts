import { describe, expect, it } from "vitest";
import type { PersonUsage } from "../../../src/data/schema/runtimeBundle";
import { matchPersonUsages } from "../../../src/domain/person/matchPersonUsages";

const usages: PersonUsage[] = [
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
];

describe("person usage matching", () => {
  it("matches only an exact complete name", () => {
    expect(matchPersonUsages("王安石", usages)).toEqual(usages);
    expect(matchPersonUsages("安石", usages)).toEqual([]);
    expect(matchPersonUsages("王安", usages)).toEqual([]);
    expect(matchPersonUsages(" 王安石 ", usages)).toEqual([]);
  });
});
