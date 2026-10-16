import type { FolkloreModuleId } from "../../domain/project/profile";

export interface FolkloreRulePackManifest {
  moduleId: FolkloreModuleId;
  schoolId: string;
  ruleVersion: string;
  reviewStatus: "research_only" | "reviewed";
  epistemicStatus?:
    | "calculation_convention"
    | "research_model"
    | "school_specific"
    | "historical_context"
    | "source_gap";
  uncertainty?: string;
  checksum: string;
  sourceIds: string[];
  sources?: Array<{
    id: string;
    verificationStatus: "unverified" | "image_checked" | "official";
  }>;
  applicableInputs: string[];
}

export interface RulePackSelection {
  moduleId: FolkloreModuleId;
  schoolId: string;
  ruleVersion: string;
}

export interface LoadedRulePack {
  id: string;
  manifest: FolkloreRulePackManifest;
  document: unknown;
  checksum: string;
}

type RawLoader = () => Promise<string>;

const manifestLoaders = import.meta.glob(
  "../../../data/sources/personal/folklore/**/manifest.json",
  { query: "?raw", import: "default" },
) as Record<string, RawLoader>;

const documentLoaders = {
  ...(import.meta.glob("../../../data/sources/personal/folklore/**/rules.json", {
    query: "?raw",
    import: "default",
  }) as Record<string, RawLoader>),
  ...(import.meta.glob("../../../data/sources/personal/folklore/**/fixtures.json", {
    query: "?raw",
    import: "default",
  }) as Record<string, RawLoader>),
};

export function rulePackId(selection: RulePackSelection): string {
  return `${selection.moduleId}/${selection.schoolId}/${selection.ruleVersion}`;
}

export async function listFolkloreRulePacks(): Promise<FolkloreRulePackManifest[]> {
  const manifests = await Promise.all(
    Object.values(manifestLoaders).map(async (load) => parseManifest(await load())),
  );
  return manifests.sort((left, right) => rulePackId(left).localeCompare(rulePackId(right)));
}

export async function loadRulePack(
  selection: RulePackSelection,
  options: { requireReviewed?: boolean } = {},
): Promise<LoadedRulePack> {
  const requestedId = rulePackId(selection);
  for (const [manifestPath, loadManifest] of Object.entries(manifestLoaders)) {
    const manifest = parseManifest(await loadManifest());
    if (rulePackId(manifest) !== requestedId) continue;
    if ((options.requireReviewed ?? true) && manifest.reviewStatus !== "reviewed")
      throw new Error(`rule-pack-not-reviewed:${requestedId}`);

    const directory = manifestPath.slice(0, manifestPath.lastIndexOf("/"));
    const documentEntry = Object.entries(documentLoaders).find(
      ([candidate]) =>
        candidate === `${directory}/rules.json` || candidate === `${directory}/fixtures.json`,
    );
    if (!documentEntry) throw new Error(`rule-pack-document-missing:${requestedId}`);
    const raw = await documentEntry[1]();
    const checksum = `sha256:${await sha256(raw)}`;
    if (checksum !== manifest.checksum)
      throw new Error(`rule-pack-checksum-mismatch:${requestedId}`);
    return {
      id: requestedId,
      manifest,
      document: JSON.parse(raw) as unknown,
      checksum,
    };
  }
  throw new Error(`rule-pack-not-found:${requestedId}`);
}

export async function loadReviewedPreset(
  selections: readonly RulePackSelection[],
): Promise<LoadedRulePack[]> {
  return Promise.all(
    selections.map((selection) => loadRulePack(selection, { requireReviewed: true })),
  );
}

function parseManifest(raw: string): FolkloreRulePackManifest {
  const value = JSON.parse(raw) as Partial<FolkloreRulePackManifest>;
  if (
    typeof value.moduleId !== "string" ||
    typeof value.schoolId !== "string" ||
    typeof value.ruleVersion !== "string" ||
    !["research_only", "reviewed"].includes(value.reviewStatus ?? "") ||
    typeof value.checksum !== "string" ||
    !Array.isArray(value.sourceIds) ||
    !Array.isArray(value.applicableInputs)
  )
    throw new Error("invalid-rule-pack-manifest");
  if (
    value.reviewStatus === "reviewed" &&
    (typeof value.epistemicStatus !== "string" ||
      !value.epistemicStatus.trim() ||
      typeof value.uncertainty !== "string" ||
      !value.uncertainty.trim())
  )
    throw new Error("invalid-reviewed-rule-pack-transparency");
  return value as FolkloreRulePackManifest;
}

async function sha256(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
