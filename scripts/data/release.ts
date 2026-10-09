import { createHash } from "node:crypto";
import { canonicalStringify } from "../../src/application/backup/checksum";

interface HumanReview {
  decision: "approve" | "edit-and-approve" | "dispute" | "retire" | "request-source";
  reviewer: string;
  reviewedAt: string;
  sourceChecked: boolean;
  semanticNote: string;
  riskNote: string;
}
interface SourceRef {
  sourceId: string;
  location: string;
  excerpt?: string;
}
interface ReviewedRecord {
  id: string;
  reviewStatus: string;
  sourceRefs: SourceRef[];
  risks: string[];
  riskSignals: unknown[];
  primaryReview?: HumanReview;
  secondaryReview?: HumanReview;
}
export interface ReleaseInput {
  characters: Array<ReviewedRecord & Record<string, unknown>>;
  allusions: Array<ReviewedRecord & Record<string, unknown>>;
  sources: Array<{ sourceId: string; releaseEligible: boolean }>;
  version?: string;
  releasedAt?: string;
  changelog?: string[];
}
export interface ReleaseThresholds {
  minCharacters: number;
  maxCharacters: number;
  minAllusions: number;
  maxAllusions: number;
}
const DEFAULT_THRESHOLDS: ReleaseThresholds = {
  minCharacters: 800,
  maxCharacters: 1200,
  minAllusions: 300,
  maxAllusions: 500,
};

export function auditReleaseInput(input: ReleaseInput, thresholds = DEFAULT_THRESHOLDS) {
  const errors: string[] = [];
  if (
    input.characters.length < thresholds.minCharacters ||
    input.characters.length > thresholds.maxCharacters
  )
    errors.push(
      `Character count must be ${thresholds.minCharacters}-${thresholds.maxCharacters}`,
    );
  if (
    input.allusions.length < thresholds.minAllusions ||
    input.allusions.length > thresholds.maxAllusions
  )
    errors.push(`Allusion count must be ${thresholds.minAllusions}-${thresholds.maxAllusions}`);
  const records = [...input.characters, ...input.allusions];
  const sourceIds = new Set(
    input.sources.filter((source) => source.releaseEligible).map((source) => source.sourceId),
  );
  const ids = new Set<string>();
  let normalRecords = 0;
  let secondaryNormalRecords = 0;
  for (const record of records) {
    if (ids.has(record.id)) errors.push(`Duplicate stable id: ${record.id}`);
    ids.add(record.id);
    if (record.reviewStatus !== "verified" || !validHumanReview(record.primaryReview))
      errors.push(`Missing human primary review: ${record.id}`);
    if (
      record.sourceRefs.length === 0 ||
      record.sourceRefs.some((source) => !sourceIds.has(source.sourceId))
    )
      errors.push(`Unknown or ineligible source: ${record.id}`);
    const highRisk = record.risks.length > 0 || record.riskSignals.length > 0;
    if (highRisk && !validSecondaryReview(record))
      errors.push(`High-risk record needs secondary review: ${record.id}`);
    if (!highRisk) {
      normalRecords += 1;
      if (validSecondaryReview(record)) secondaryNormalRecords += 1;
    }
  }
  if (normalRecords > 0 && secondaryNormalRecords / normalRecords < 0.1)
    errors.push("At least ten percent of normal records need secondary review");
  for (const record of input.characters) {
    const char = record.char;
    if (
      typeof char !== "string" ||
      [...char].length !== 1 ||
      !/^\p{Script=Han}$/u.test(char) ||
      char !== char.normalize("NFC")
    )
      errors.push(`Invalid Unicode character: ${record.id}`);
  }
  for (const record of input.allusions) {
    for (const field of ["title", "work", "quote", "selectedText", "interpretation"] as const) {
      const value = record[field];
      if (typeof value !== "string" || !isValidNfcUnicode(value))
        errors.push(`Invalid Unicode or NFC in allusion ${field}: ${record.id}`);
    }
    if (
      typeof record.selectedText === "string" &&
      (![...record.selectedText].every((char) => /^\p{Script=Han}$/u.test(char)) ||
        [...record.selectedText].length < 1 ||
        [...record.selectedText].length > 2)
    )
      errors.push(`Invalid allusion selectedText: ${record.id}`);
  }
  return {
    ok: errors.length === 0,
    errors,
    counts: {
      characters: input.characters.length,
      allusions: input.allusions.length,
      normalSecondaryRate: normalRecords ? secondaryNormalRecords / normalRecords : 1,
    },
  };
}

export function buildRuntimeBundle(
  input: ReleaseInput & { version: string; releasedAt: string; changelog: string[] },
  thresholds = DEFAULT_THRESHOLDS,
) {
  const audit = auditReleaseInput(input, thresholds);
  if (!audit.ok) throw new Error(audit.errors.join("\n"));
  const characters = input.characters.map(toRuntimeCharacter).sort(byCharacter);
  const allusions = input.allusions.map(toRuntimeAllusion).sort(byId);
  const content = { characters, allusions };
  return {
    manifest: {
      version: input.version,
      status: "production" as const,
      builtAt: input.releasedAt,
      contentHash: createHash("sha256").update(canonicalStringify(content)).digest("hex"),
      counts: { characters: characters.length, allusions: allusions.length },
      sources: input.sources
        .filter((source) => source.releaseEligible)
        .map((source) => source.sourceId)
        .sort(),
      review: { normalSecondaryRate: audit.counts.normalSecondaryRate },
      changelog: input.changelog,
    },
    characters,
    allusions,
  };
}

function validHumanReview(review?: HumanReview): boolean {
  return Boolean(
    review?.reviewer &&
    (review.decision === "approve" || review.decision === "edit-and-approve") &&
    review.sourceChecked &&
    review.semanticNote &&
    review.riskNote &&
    !Number.isNaN(Date.parse(review.reviewedAt)),
  );
}
function validSecondaryReview(record: ReviewedRecord): boolean {
  return (
    validHumanReview(record.secondaryReview) &&
    (record.secondaryReview?.decision === "approve" ||
      record.secondaryReview?.decision === "edit-and-approve") &&
    record.secondaryReview?.reviewer !== record.primaryReview?.reviewer
  );
}
function isValidNfcUnicode(value: string): boolean {
  if (value !== value.normalize("NFC")) return false;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) return false;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) return false;
  }
  return true;
}
function toRuntimeCharacter(record: Record<string, unknown>) {
  return {
    char: record.char,
    pinyin: record.pinyin,
    meanings: record.meanings,
    styleTags: record.styleTags,
    risks: record.risks,
    riskSignals: record.riskSignals,
    reviewStatus: record.reviewStatus,
    sourceRefs: record.sourceRefs,
    ...(record.strokes !== undefined ? { strokes: record.strokes } : {}),
    ...(record.genderExpression !== undefined
      ? { genderExpression: record.genderExpression }
      : {}),
    ...(record.element !== undefined ? { element: record.element } : {}),
    ...(record.elementReason !== undefined ? { elementReason: record.elementReason } : {}),
    ...(record.elementEvidence !== undefined
      ? { elementEvidence: record.elementEvidence }
      : {}),
    ...(record.checkedAt !== undefined ? { checkedAt: record.checkedAt } : {}),
  };
}
function toRuntimeAllusion(record: Record<string, unknown>) {
  return {
    id: record.id,
    title: record.title,
    work: record.work,
    quote: record.quote,
    selectedText: record.selectedText,
    interpretation: record.interpretation,
    styleTags: record.styleTags,
    risks: record.risks,
    riskSignals: record.riskSignals,
    reviewStatus: record.reviewStatus,
    sourceRefs: record.sourceRefs,
  };
}
function byId(left: { id?: unknown }, right: { id?: unknown }) {
  return String(left.id).localeCompare(String(right.id));
}
function byCharacter(left: { char?: unknown }, right: { char?: unknown }) {
  return String(left.char).localeCompare(String(right.char));
}
