export const CHARACTER_ELEMENT_METHOD_VERSION = "semantic-imagery-1";
export const CHARACTER_ELEMENT_REVIEW_STATUS = "source_checked";
export const FIVE_ELEMENTS = Object.freeze(["wood", "fire", "earth", "metal", "water"]);

const elementSet = new Set(FIVE_ELEMENTS);

export function parseCharacterRows(tsv) {
  return tsv
    .trim()
    .split(/\r?\n/u)
    .map((line, index) => {
      const columns = line.split("\t");
      if (columns.length < 2 || columns.length > 3)
        throw new Error(`Invalid characters.tsv row ${index + 1}`);
      const [char, meaning, element] = columns;
      return { char, meaning, element, line: index + 1 };
    });
}

export function validateCharacterElementSource({
  source,
  characterRows,
  toSimplified = (value) => value,
}) {
  const failures = [];
  const records = source?.records;
  if (source?.schemaVersion !== 1) failures.push("Unsupported character-element schema");
  if (!Array.isArray(records)) failures.push("Character-element records are missing");
  if (!Array.isArray(records)) return failures;

  const expectedChars = characterRows.map(({ char }) => char);
  const actualChars = records.map(({ char }) => char);
  if (records.length !== 303) failures.push(`Expected 303 records, found ${records.length}`);
  if (new Set(actualChars).size !== actualChars.length)
    failures.push("Duplicate character-element records");
  if (JSON.stringify(actualChars) !== JSON.stringify(expectedChars))
    failures.push("Character-element records do not exactly follow characters.tsv");
  const expectedCounts = Object.fromEntries([
    ["total", records.length],
    ...FIVE_ELEMENTS.map((element) => [
      element,
      records.filter((record) => record.element === element).length,
    ]),
  ]);
  if (JSON.stringify(source.manifest?.counts) !== JSON.stringify(expectedCounts))
    failures.push("Character-element count metadata is stale");

  const rowsByChar = new Map(characterRows.map((row) => [row.char, row]));
  for (const record of records) {
    const row = rowsByChar.get(record.char);
    if (!elementSet.has(record.element))
      failures.push(`Invalid element for ${record.char}: ${record.element}`);
    if (record.methodVersion !== CHARACTER_ELEMENT_METHOD_VERSION)
      failures.push(`Unexpected method version for ${record.char}`);
    if (record.reviewStatus !== CHARACTER_ELEMENT_REVIEW_STATUS)
      failures.push(`Character ${record.char} must remain source_checked`);
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(record.checkedAt ?? ""))
      failures.push(`Invalid checkedAt for ${record.char}`);
    if (
      typeof record.reason !== "string" ||
      record.reason.length < 18 ||
      !record.reason.includes(`“${record.char}”`)
    )
      failures.push(`Character-specific reason missing for ${record.char}`);
    if (
      !Array.isArray(record.sourceRefs) ||
      record.sourceRefs.length < 2 ||
      !record.sourceRefs.includes(`character-meaning:${record.char}`) ||
      !record.sourceRefs.includes(CHARACTER_ELEMENT_METHOD_VERSION)
    )
      failures.push(`Source references incomplete for ${record.char}`);
    if (toSimplified(record.char) !== record.char)
      failures.push(`Traditional character in character-element source: ${record.char}`);
    if (toSimplified(record.reason) !== record.reason)
      failures.push(`Traditional text in character-element reason: ${record.char}`);
    if (row?.element && row.element !== record.element)
      failures.push(
        `Existing element mismatch for ${record.char}: ${row.element} != ${record.element}`,
      );
  }
  if (new Set(records.map(({ reason }) => reason)).size !== records.length)
    failures.push("Character-element reasons must be unique");
  return failures;
}

export function buildCharacterElementIndex({ source, characterRows, toSimplified }) {
  const failures = validateCharacterElementSource({
    source,
    characterRows,
    ...(toSimplified ? { toSimplified } : {}),
  });
  if (failures.length) throw new Error(failures.join("\n"));
  return new Map(source.records.map((record) => [record.char, record]));
}
