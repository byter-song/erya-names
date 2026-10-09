import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import YAML from "yaml";

const SOURCE_PATH = "data/sources/personal/traditional-to-simplified.json";
const RUNTIME_PATH = "src/data/curated/traditional-to-simplified.json";
const CONTRACT_PATH = "data/sources/sources/opencc.yaml";
const SOURCE_LOCATION = "data/dictionary/TSCharacters.txt";
const VERSION = "traditional-to-simplified-2026.09.30";
const CHECKED_AT = "2026-09-30";

const source = JSON.parse(await readFile(SOURCE_PATH, "utf8"));
const runtime = JSON.parse(await readFile(RUNTIME_PATH, "utf8"));
const contract = YAML.parse(await readFile(CONTRACT_PATH, "utf8"));
const contractFile = contract.files?.find((file) => file.path === SOURCE_LOCATION);
const failures = [];
const entries = Object.entries(source.mappings ?? {});
const [sourceRef] = source.manifest?.sourceRefs ?? [];

if (source.schemaVersion !== 1) failures.push("Unsupported source schema version");
if (source.manifest?.version !== VERSION) failures.push("Unexpected mapping version");
if (source.manifest?.checkedAt !== CHECKED_AT) failures.push("Stale mapping check date");
if (
  source.manifest?.sourceRefs?.length !== 1 ||
  sourceRef?.sourceId !== contract.sourceId ||
  sourceRef?.version !== contract.commit ||
  sourceRef?.location !== SOURCE_LOCATION ||
  sourceRef?.sha256 !== contractFile?.sha256
) {
  failures.push("Source reference does not match the fixed OpenCC contract");
}
if (
  source.manifest?.inputSha256 !== contractFile?.sha256 ||
  !/^[a-f0-9]{64}$/u.test(source.manifest?.inputSha256 ?? "")
) {
  failures.push("Source input hash does not match the fixed TSCharacters file");
}
if (
  entries.some(
    ([traditional, simplified]) =>
      typeof simplified !== "string" ||
      [...traditional].length !== 1 ||
      [...simplified].length !== 1 ||
      traditional !== traditional.normalize("NFC") ||
      simplified !== simplified.normalize("NFC"),
  )
) {
  failures.push("Mappings must contain only single NFC characters");
}
if (source.manifest?.counts?.mappings !== entries.length) {
  failures.push("Mapping count metadata mismatch");
}
if (source.manifest?.contentSha256 !== hashJson(source.mappings)) {
  failures.push("Mapping content hash mismatch");
}
for (const [traditional, simplified] of [
  ["臺", "台"],
  ["學", "学"],
  ["詩", "诗"],
]) {
  if (source.mappings?.[traditional] !== simplified) {
    failures.push(`Expected ${traditional} to map to ${simplified}`);
  }
}
if (
  runtime.schemaVersion !== source.schemaVersion ||
  JSON.stringify(runtime.manifest) !== JSON.stringify(source.manifest) ||
  JSON.stringify(runtime.mappings) !== JSON.stringify(source.mappings)
) {
  failures.push("Runtime mapping asset is not derived from the committed SSOT");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Traditional-to-simplified audit passed: ${entries.length} mappings.`);
}

function hashJson(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
