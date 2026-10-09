import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import personalBundle from "../../../src/data/curated/personal-bundle.json";
import runtimePinyin from "../../../src/data/curated/standard-character-pinyin.json";
import standardCharacters from "../../../src/data/curated/standard-characters.json";
import sourcePinyin from "../../../data/sources/personal/standard-character-pinyin.json";

describe("standard character pinyin index", () => {
  it("covers every currently supported standard character and records coverage gaps", () => {
    const official = [...standardCharacters.characters];
    const covered = Object.keys(sourcePinyin.index);
    const missing = official.filter(
      (char) => !sourcePinyin.index[char as keyof typeof sourcePinyin.index],
    );

    expect(new Set(covered).size).toBe(covered.length);
    expect(covered.every((char) => official.includes(char))).toBe(true);
    expect(sourcePinyin.missingCharacters).toEqual(missing);
    expect(sourcePinyin.manifest.counts).toMatchObject({
      standardCharacters: 8105,
      coveredCharacters: covered.length,
      missingCharacters: missing.length,
    });
  });

  it("records every normalized multi-pronunciation reading and stable hashes", () => {
    const polyphonic = Object.fromEntries(
      Object.entries(sourcePinyin.index).filter(([, readings]) => readings.length > 1),
    );

    for (const readings of Object.values(sourcePinyin.index)) {
      expect(readings.length).toBeGreaterThan(0);
      expect(new Set(readings).size).toBe(readings.length);
      expect(readings.every((reading) => reading === reading.normalize("NFC"))).toBe(true);
    }
    expect(sourcePinyin.polyphonicCharacters).toEqual(polyphonic);
    expect(sourcePinyin.manifest.counts.polyphonicCharacters).toBe(
      Object.keys(polyphonic).length,
    );
    expect(sourcePinyin.manifest.indexSha256).toBe(hash(sourcePinyin.index));
    expect(sourcePinyin.manifest.contentSha256).toBe(
      hash({
        index: sourcePinyin.index,
        missingCharacters: sourcePinyin.missingCharacters,
        polyphonicCharacters: sourcePinyin.polyphonicCharacters,
      }),
    );
  });

  it("keeps the runtime derivative aligned without expanding generated character cards", () => {
    expect(runtimePinyin.index).toEqual(sourcePinyin.index);
    expect(runtimePinyin.manifest.sourceContentSha256).toBe(
      sourcePinyin.manifest.contentSha256,
    );
    expect(runtimePinyin.manifest.sourceRefs.map(({ sourceId }) => sourceId)).toEqual([
      "standard-hanzi-2013",
      "pinyin-data",
    ]);
    expect(personalBundle.characters).toHaveLength(303);
    expect(personalBundle.characters.every(({ char }) => char in runtimePinyin.index)).toBe(
      true,
    );
  });
});

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
