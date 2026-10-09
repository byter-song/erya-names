import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import characterElements from "../../../data/sources/personal/character-elements.json";
import traditionalToSimplified from "../../../data/sources/personal/traditional-to-simplified.json";
import {
  buildCharacterElementIndex,
  CHARACTER_ELEMENT_METHOD_VERSION,
  FIVE_ELEMENTS,
  parseCharacterRows,
  validateCharacterElementSource,
  type CharacterElementSource,
} from "../../../scripts/data/characterElements.mjs";

const characterElementSource = characterElements as CharacterElementSource;
const characterRows = parseCharacterRows(
  readFileSync("data/sources/personal/characters.tsv", "utf8"),
);
const toSimplified = (value: string) =>
  [...value]
    .map(
      (char) =>
        traditionalToSimplified.mappings[
          char as keyof typeof traditionalToSimplified.mappings
        ] ?? char,
    )
    .join("");

describe("character element source", () => {
  it("covers all 303 character cards exactly once in source order", () => {
    expect(characterElementSource.records).toHaveLength(303);
    expect(characterElementSource.records.map(({ char }) => char)).toEqual(
      characterRows.map(({ char }: { char: string }) => char),
    );
    expect(new Set(characterElementSource.records.map(({ char }) => char)).size).toBe(303);
  });

  it("keeps classifications source_checked, explainable, and Simplified Chinese", () => {
    expect(
      validateCharacterElementSource({
        source: characterElementSource,
        characterRows,
        toSimplified,
      }),
    ).toEqual([]);
    expect(
      characterElementSource.records.every(
        ({ element, methodVersion, reviewStatus, reason, char, sourceRefs }) =>
          FIVE_ELEMENTS.includes(element) &&
          methodVersion === CHARACTER_ELEMENT_METHOD_VERSION &&
          reviewStatus === "source_checked" &&
          reason.includes(`“${char}”`) &&
          sourceRefs.includes(`character-meaning:${char}`),
      ),
    ).toBe(true);
    expect([
      ...new Set(characterElementSource.records.map(({ reviewStatus }) => reviewStatus)),
    ]).toEqual(["source_checked"]);
  });

  it("preserves every element already supplied in characters.tsv", () => {
    const byChar = buildCharacterElementIndex({
      source: characterElementSource,
      characterRows,
      toSimplified,
    });
    for (const row of characterRows) {
      if (row.element) expect(byChar.get(row.char)?.element).toBe(row.element);
    }
  });

  it("rejects a changed legacy classification", () => {
    const source = structuredClone(characterElementSource);
    const existing = source.records.find(({ char }) => char === "清");
    if (!existing) throw new Error("Missing fixture character 清");
    existing.element = "fire";
    expect(validateCharacterElementSource({ source, characterRows, toSimplified })).toContain(
      "Existing element mismatch for 清: water != fire",
    );
  });
});
