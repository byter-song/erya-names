import { readFile } from "node:fs/promises";
import {
  FIVE_ELEMENTS,
  parseCharacterRows,
  validateCharacterElementSource,
} from "./characterElements.mjs";

const [sourceText, charactersTsv, conversionText] = await Promise.all([
  readFile("data/sources/personal/character-elements.json", "utf8"),
  readFile("data/sources/personal/characters.tsv", "utf8"),
  readFile("data/sources/personal/traditional-to-simplified.json", "utf8"),
]);
const source = JSON.parse(sourceText);
const characterRows = parseCharacterRows(charactersTsv);
const conversion = JSON.parse(conversionText).mappings;
const failures = validateCharacterElementSource({
  source,
  characterRows,
  toSimplified: (value) => [...value].map((char) => conversion[char] ?? char).join(""),
});

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  const counts = Object.fromEntries(
    FIVE_ELEMENTS.map((element) => [
      element,
      source.records.filter((record) => record.element === element).length,
    ]),
  );
  console.log(
    `Character-element audit passed: ${source.records.length}/303 source_checked records (${FIVE_ELEMENTS.map((element) => `${element}=${counts[element]}`).join(", ")}). Traditional folklore reference; not a unique authoritative classification.`,
  );
}
