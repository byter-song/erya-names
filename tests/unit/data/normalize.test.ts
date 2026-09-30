import { describe, expect, it } from "vitest";
import { normalizeUnicodeText } from "../../../scripts/data/normalize/unicode";
import { parsePinyinData } from "../../../scripts/data/normalize/pinyin";
import { normalizeAllusionRecords } from "../../../scripts/data/normalize/allusions";
import {
  normalizeImperialExamRows,
  normalizePersonRows,
} from "../../../scripts/data/normalize/persons";

describe("data normalization", () => {
  it("normalizes Unicode and punctuation while preserving the original text", () => {
    expect(
      normalizeUnicodeText(
        "羲和之未揚, 若華何光!",
        new Map([
          ["揚", "扬"],
          ["華", "华"],
        ]),
      ),
    ).toEqual({
      originalText: "羲和之未揚, 若華何光!",
      normalizedText: "羲和之未扬，若华何光！",
      conversions: [
        { from: "揚", to: "扬", index: 4 },
        { from: "華", to: "华", index: 7 },
      ],
    });
  });

  it("parses one-to-many pinyin without silently choosing a reading", () => {
    const result = parsePinyinData("U+884C: xíng,háng,hàng  # 行\nU+6E05: qīng  # 清");
    expect(result.get("行")).toEqual(["xíng", "háng", "hàng"]);
    expect(result.get("清")).toEqual(["qīng"]);
  });

  it("normalizes different classic schemas into stable source records", () => {
    const records = normalizeAllusionRecords([
      {
        sourceId: "shijing",
        kind: "shijing",
        data: [
          {
            title: "关雎",
            chapter: "国风",
            section: "周南",
            content: ["关关雎鸠，在河之洲。"],
          },
        ],
      },
      {
        sourceId: "lunyu",
        kind: "lunyu",
        data: [{ chapter: "学而篇", paragraphs: ["学而时习之，不亦说乎？"] }],
      },
    ]);
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      sourceId: "lunyu",
      work: "论语",
      title: "学而篇",
      originalText: "学而时习之，不亦说乎？",
    });
    expect(records[1]).toMatchObject({
      sourceId: "shijing",
      work: "诗经",
      title: "关雎",
      location: "国风·周南",
    });
  });

  it("normalizes allowlisted Wikidata people without inventing rank claims", () => {
    expect(
      normalizePersonRows(
        [
          {
            qid: "Q319618",
            name: "王安石",
            period: "北宋（1021—1086）",
            description: "北宋政治家、文学家、思想家。",
          },
        ],
        "2026-09-30",
      ),
    ).toEqual([
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
    ]);
    expect(() =>
      normalizePersonRows(
        [
          {
            qid: "Q1",
            name: "非白名单人物",
            period: "未知",
            description: "不应进入产物。",
          },
        ],
        "2026-09-30",
      ),
    ).toThrow("Person QID is not allowlisted: Q1");
  });

  it("keeps imperial-exam identity and required rank evidence explicit", () => {
    expect(
      normalizeImperialExamRows(
        [
          {
            id: "imperial-exam:1904:3",
            name: "商衍鎏",
            period: "清·光绪三十年（1904）",
            identityType: "tanhua",
            description: "光绪三十年甲辰恩科进士。",
            rankEvidence: "甲辰恩科殿试一甲第三名。",
            sourceRefs: [
              {
                sourceId: "manual-imperial-exam-curation",
                location: "光绪三十年甲辰恩科殿试金榜第一甲第三名",
              },
            ],
          },
        ],
        "2026-09-30",
      ),
    ).toEqual([
      expect.objectContaining({
        id: "person:imperial-exam:1904:3",
        identityType: "tanhua",
        rankEvidence: "甲辰恩科殿试一甲第三名。",
      }),
    ]);
  });
});
