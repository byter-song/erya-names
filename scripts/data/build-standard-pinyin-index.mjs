import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { format } from "prettier";
import YAML from "yaml";
import prettierConfig from "../../prettier.config.js";

const SOURCE_PATH = "data/sources/personal/standard-character-pinyin.json";
const RUNTIME_PATH = "src/data/curated/standard-character-pinyin.json";
const STANDARD_PATH = "src/data/curated/standard-characters.json";
const PINYIN_CONTRACT_PATH = "data/sources/sources/pinyin-data.yaml";
const PINYIN_CACHE_PATH = "data/cache/pinyin-data/pinyin.txt";
const VERSION = "standard-character-pinyin-2026.09.30";
const CHECKED_AT = "2026-09-30";

const args = new Set(process.argv.slice(2));
const refreshSource = args.delete("--refresh-source");
const checkOnly = args.delete("--check");
if (args.size) throw new Error(`Unknown arguments: ${[...args].join(", ")}`);

const standardText = await readFile(STANDARD_PATH, "utf8");
const standard = JSON.parse(standardText);
const pinyinContract = YAML.parse(await readFile(PINYIN_CONTRACT_PATH, "utf8"));

const source = refreshSource
  ? await buildSource({ standard, standardText, pinyinContract })
  : JSON.parse(await readFile(SOURCE_PATH, "utf8"));
validateSource({ source, standard, standardText, pinyinContract });

const runtime = {
  schemaVersion: source.schemaVersion,
  manifest: {
    version: source.manifest.version,
    checkedAt: source.manifest.checkedAt,
    sourceRefs: source.manifest.sourceRefs.map(({ sourceId, version }) => ({
      sourceId,
      version,
    })),
    counts: source.manifest.counts,
    sourceContentSha256: source.manifest.contentSha256,
    indexSha256: source.manifest.indexSha256,
  },
  index: source.index,
};

const sourceOutput = await serialize(source);
const runtimeOutput = await serialize(runtime);
if (checkOnly) {
  if (refreshSource) await assertFileMatches(SOURCE_PATH, sourceOutput);
  await assertFileMatches(RUNTIME_PATH, runtimeOutput);
  console.log(
    `Standard pinyin index is current: ${source.manifest.counts.coveredCharacters}/${source.manifest.counts.standardCharacters} covered, ${source.manifest.counts.missingCharacters} missing, ${source.manifest.counts.polyphonicCharacters} polyphonic.`,
  );
} else {
  if (refreshSource) await writeFile(SOURCE_PATH, sourceOutput, "utf8");
  await writeFile(RUNTIME_PATH, runtimeOutput, "utf8");
  console.log(
    `Standard pinyin index built: ${source.manifest.counts.coveredCharacters}/${source.manifest.counts.standardCharacters} covered, ${source.manifest.counts.missingCharacters} missing, ${source.manifest.counts.polyphonicCharacters} polyphonic.`,
  );
}

async function buildSource({ standard, standardText, pinyinContract }) {
  const pinyinText = await readFile(PINYIN_CACHE_PATH, "utf8");
  const pinyinFile = pinyinContract.files?.find((file) => file.path === "pinyin.txt");
  if (!pinyinFile?.sha256) throw new Error("pinyin-data contract lacks pinyin.txt hash");
  if (sha256(pinyinText) !== pinyinFile.sha256)
    throw new Error("Cached pinyin.txt does not match its fixed source contract");

  const upstream = parsePinyinData(pinyinText);
  const index = {};
  const missingCharacters = [];
  const polyphonicCharacters = {};
  for (const char of standard.characters) {
    const readings = [...new Set((upstream.get(char) ?? []).map(normalizeReading))];
    if (!readings.length) {
      missingCharacters.push(char);
      continue;
    }
    index[char] = readings;
    if (readings.length > 1) polyphonicCharacters[char] = readings;
  }

  const content = { index, missingCharacters, polyphonicCharacters };
  return {
    schemaVersion: 1,
    manifest: {
      version: VERSION,
      checkedAt: CHECKED_AT,
      sourceRefs: [
        {
          sourceId: standard.sourceId,
          version: "2013",
          location: STANDARD_PATH,
          sha256: sha256(standardText),
        },
        {
          sourceId: pinyinContract.sourceId,
          version: pinyinContract.commit,
          location: "pinyin.txt",
          sha256: pinyinFile.sha256,
        },
      ],
      counts: {
        standardCharacters: [...standard.characters].length,
        coveredCharacters: Object.keys(index).length,
        missingCharacters: missingCharacters.length,
        polyphonicCharacters: Object.keys(polyphonicCharacters).length,
      },
      contentSha256: sha256(JSON.stringify(content)),
      indexSha256: sha256(JSON.stringify(index)),
    },
    ...content,
  };
}

function validateSource({ source, standard, standardText, pinyinContract }) {
  if (source.schemaVersion !== 1) throw new Error("Unsupported pinyin index schema");
  if (source.manifest.version !== VERSION || source.manifest.checkedAt !== CHECKED_AT)
    throw new Error("Pinyin index version or check date is stale");

  const standardRef = source.manifest.sourceRefs.find(
    (ref) => ref.sourceId === standard.sourceId,
  );
  const pinyinRef = source.manifest.sourceRefs.find(
    (ref) => ref.sourceId === pinyinContract.sourceId,
  );
  const pinyinFile = pinyinContract.files?.find((file) => file.path === "pinyin.txt");
  if (
    standardRef?.sha256 !== sha256(standardText) ||
    standardRef.version !== "2013" ||
    pinyinRef?.version !== pinyinContract.commit ||
    pinyinRef.sha256 !== pinyinFile?.sha256
  )
    throw new Error("Pinyin index source references do not match fixed inputs");

  const standardCharacters = [...standard.characters];
  const standardSet = new Set(standardCharacters);
  const indexedCharacters = Object.keys(source.index);
  const expectedMissing = standardCharacters.filter((char) => !source.index[char]);
  if (indexedCharacters.some((char) => !standardSet.has(char)))
    throw new Error("Pinyin index contains characters outside the official table");
  if (JSON.stringify(source.missingCharacters) !== JSON.stringify(expectedMissing))
    throw new Error("Pinyin index missing-character audit is stale");

  for (const [char, readings] of Object.entries(source.index)) {
    if (
      !Array.isArray(readings) ||
      !readings.length ||
      readings.some(
        (reading) =>
          typeof reading !== "string" || !reading || reading !== reading.normalize("NFC"),
      ) ||
      new Set(readings).size !== readings.length
    )
      throw new Error(`Invalid pinyin readings for ${char}`);
  }

  const expectedPolyphonic = Object.fromEntries(
    Object.entries(source.index).filter(([, readings]) => readings.length > 1),
  );
  const counts = {
    standardCharacters: standardCharacters.length,
    coveredCharacters: indexedCharacters.length,
    missingCharacters: expectedMissing.length,
    polyphonicCharacters: Object.keys(expectedPolyphonic).length,
  };
  if (
    JSON.stringify(source.polyphonicCharacters) !== JSON.stringify(expectedPolyphonic) ||
    JSON.stringify(source.manifest.counts) !== JSON.stringify(counts) ||
    source.manifest.indexSha256 !== sha256(JSON.stringify(source.index)) ||
    source.manifest.contentSha256 !==
      sha256(
        JSON.stringify({
          index: source.index,
          missingCharacters: source.missingCharacters,
          polyphonicCharacters: source.polyphonicCharacters,
        }),
      )
  )
    throw new Error("Pinyin index audit metadata or hashes are stale");
}

function parsePinyinData(input) {
  const result = new Map();
  for (const line of input.split(/\r?\n/u)) {
    const match = line.match(/^U\+([0-9A-F]+):\s*([^#]+?)\s*(?:#.*)?$/u);
    if (!match) continue;
    const point = Number.parseInt(match[1] ?? "", 16);
    const readings = (match[2] ?? "").split(",").map(normalizeReading).filter(Boolean);
    if (Number.isFinite(point) && readings.length)
      result.set(String.fromCodePoint(point), readings);
  }
  return result;
}

function normalizeReading(reading) {
  return reading.trim().normalize("NFC");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function serialize(value) {
  return format(JSON.stringify(value), { ...prettierConfig, parser: "json" });
}

async function assertFileMatches(path, expected) {
  const actual = await readFile(path, "utf8");
  if (actual !== expected)
    throw new Error(`${path} is stale; rebuild the runtime pinyin asset`);
}
