import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import YAML from "yaml";

const SOURCE_PATH = "data/sources/personal/traditional-to-simplified.json";
const RUNTIME_PATH = "src/data/curated/traditional-to-simplified.json";
const CONTRACT_PATH = "data/sources/sources/opencc.yaml";
const CACHE_PATH = "data/cache/opencc/data/dictionary/TSCharacters.txt";
const SOURCE_ID = "opencc";
const SOURCE_LOCATION = "data/dictionary/TSCharacters.txt";
const SOURCE_COMMIT = "5c764a5a886f46eb365656ed91a0410d7162fac6";
const SOURCE_INPUT_SHA256 = "9ff46a7d30e5765375eb13d33f2b03a34d298913caf2b120380679f33ae1642d";
const VERSION = "traditional-to-simplified-2026.09.30";
const CHECKED_AT = "2026-09-30";

const args = new Set(process.argv.slice(2));
const refreshSource = args.delete("--refresh-source");
const checkOnly = args.delete("--check");
if (args.size) throw new Error(`Unknown arguments: ${[...args].join(", ")}`);

const source = refreshSource
  ? await buildSourceFromFixedCache()
  : JSON.parse(await readFile(SOURCE_PATH, "utf8"));
validateSource(source);

const runtime = {
  schemaVersion: source.schemaVersion,
  manifest: source.manifest,
  mappings: source.mappings,
};
const sourceOutput = serialize(source);
const runtimeOutput = serialize(runtime);

if (checkOnly) {
  if (refreshSource) await assertFileMatches(SOURCE_PATH, sourceOutput);
  await assertFileMatches(RUNTIME_PATH, runtimeOutput);
  console.log(
    `Traditional-to-simplified mapping is current: ${source.manifest.counts.mappings} mappings.`,
  );
} else {
  if (refreshSource) await writeFile(SOURCE_PATH, sourceOutput, "utf8");
  await writeFile(RUNTIME_PATH, runtimeOutput, "utf8");
  console.log(
    `Traditional-to-simplified mapping built: ${source.manifest.counts.mappings} mappings.`,
  );
}

async function buildSourceFromFixedCache() {
  const contract = YAML.parse(await readFile(CONTRACT_PATH, "utf8"));
  const contractFile = contract.files?.find((file) => file.path === SOURCE_LOCATION);
  if (
    contract.sourceId !== SOURCE_ID ||
    contract.commit !== SOURCE_COMMIT ||
    contractFile?.sha256 !== SOURCE_INPUT_SHA256
  ) {
    throw new Error("OpenCC source contract does not match the fixed TSCharacters input");
  }

  const input = await readFile(CACHE_PATH, "utf8");
  if (sha256(input) !== SOURCE_INPUT_SHA256) {
    throw new Error("Cached TSCharacters.txt does not match its fixed source contract");
  }

  const mappings = parseMappings(input);
  return {
    schemaVersion: 1,
    manifest: {
      version: VERSION,
      checkedAt: CHECKED_AT,
      sourceRefs: [
        {
          sourceId: SOURCE_ID,
          version: SOURCE_COMMIT,
          location: SOURCE_LOCATION,
          sha256: SOURCE_INPUT_SHA256,
        },
      ],
      counts: { mappings: Object.keys(mappings).length },
      inputSha256: SOURCE_INPUT_SHA256,
      contentSha256: hashJson(mappings),
    },
    mappings,
  };
}

function parseMappings(input) {
  const mappings = {};
  for (const [index, line] of input.split(/\r?\n/u).entries()) {
    if (!line || line.startsWith("#")) continue;

    const [traditionalRaw, valuesRaw] = line.split("\t");
    const simplifiedRaw = valuesRaw?.trim().split(/\s+/u)[0];
    if (!traditionalRaw || !simplifiedRaw) {
      throw new Error(`Malformed TSCharacters entry at line ${index + 1}`);
    }

    const traditional = traditionalRaw.normalize("NFC");
    const simplified = simplifiedRaw.normalize("NFC");
    if ([...traditional].length !== 1 || [...simplified].length !== 1) {
      throw new Error(
        `TSCharacters entry is not a single-character mapping at line ${index + 1}`,
      );
    }
    if (Object.hasOwn(mappings, traditional)) {
      throw new Error(`Duplicate TSCharacters key ${traditional} at line ${index + 1}`);
    }

    // OpenCC orders alternatives by default preference; t2s uses the first candidate.
    mappings[traditional] = simplified;
  }
  return mappings;
}

function validateSource(source) {
  if (source.schemaVersion !== 1) throw new Error("Unsupported mapping schema version");
  if (source.manifest?.version !== VERSION || source.manifest?.checkedAt !== CHECKED_AT) {
    throw new Error("Traditional-to-simplified mapping version or check date is stale");
  }

  const [sourceRef] = source.manifest.sourceRefs ?? [];
  if (
    source.manifest.sourceRefs?.length !== 1 ||
    sourceRef?.sourceId !== SOURCE_ID ||
    sourceRef?.version !== SOURCE_COMMIT ||
    sourceRef?.location !== SOURCE_LOCATION ||
    sourceRef?.sha256 !== SOURCE_INPUT_SHA256 ||
    source.manifest.inputSha256 !== SOURCE_INPUT_SHA256
  ) {
    throw new Error("Traditional-to-simplified source reference is not pinned correctly");
  }

  if (
    !source.mappings ||
    typeof source.mappings !== "object" ||
    Array.isArray(source.mappings)
  ) {
    throw new Error("Traditional-to-simplified mappings must be an object");
  }
  for (const [traditional, simplified] of Object.entries(source.mappings)) {
    if (
      typeof simplified !== "string" ||
      [...traditional].length !== 1 ||
      [...simplified].length !== 1 ||
      traditional !== traditional.normalize("NFC") ||
      simplified !== simplified.normalize("NFC")
    ) {
      throw new Error(`Invalid single-character NFC mapping for ${traditional}`);
    }
  }

  const mappingCount = Object.keys(source.mappings).length;
  if (
    source.manifest.counts?.mappings !== mappingCount ||
    source.manifest.contentSha256 !== hashJson(source.mappings)
  ) {
    throw new Error("Traditional-to-simplified count or content hash is stale");
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hashJson(value) {
  return sha256(JSON.stringify(value));
}

function serialize(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function assertFileMatches(path, expected) {
  const actual = await readFile(path, "utf8");
  if (actual !== expected) throw new Error(`${path} is stale; rebuild the mapping asset`);
}
