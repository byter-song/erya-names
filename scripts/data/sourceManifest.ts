import { z } from "zod";

const checksumSchema = z.string().regex(/^[a-f0-9]{64}$/);
const safeRelativePathSchema = z
  .string()
  .min(1)
  .refine(
    (value) => !pathIsAbsolute(value) && !value.split(/[\\/]/u).includes(".."),
    "Source paths must stay within their configured root",
  );
const licenseSchema = z.object({
  spdx: z.enum(["MIT", "Apache-2.0", "CC0-1.0", "CC-BY-SA-4.0", "OFFICIAL", "UNKNOWN"]),
  file: safeRelativePathSchema,
  sha256: checksumSchema,
});
const commonSourceFields = {
  sourceId: z.string().regex(/^[a-z0-9-]+$/),
  license: licenseSchema,
  uses: z
    .array(z.enum(["characters", "pinyin", "phrases", "conversion", "allusions", "persons"]))
    .min(1),
  reviewStatus: z.enum(["draft", "source_checked", "verified", "disputed", "retired"]),
  releaseEligible: z.boolean(),
  personalEligible: z.boolean().default(false),
  notes: z.string().min(1),
};

const gitSourceManifestSchema = z.object({
  ...commonSourceFields,
  sourceType: z.literal("git"),
  repository: z.url(),
  commit: z.string().regex(/^[a-f0-9]{40}$/),
  sourceUrl: z.never().optional(),
  files: z.array(z.object({ path: safeRelativePathSchema, sha256: checksumSchema })).min(1),
});

const pinnedSnapshotFileSchema = z
  .object({
    path: safeRelativePathSchema,
    sha256: checksumSchema,
    url: z.url(),
    revision: z.string().regex(/^\d+$/),
  })
  .superRefine((file, context) => {
    const pinnedRevision = new URL(file.url).searchParams.get("oldid");
    if (pinnedRevision !== file.revision) {
      context.addIssue({
        code: "custom",
        message: "Snapshot URL oldid must match its declared revision",
        path: ["url"],
      });
    }
  });

const curatedFileSchema = z.object({
  path: safeRelativePathSchema,
  sha256: checksumSchema,
});

const snapshotSourceManifestSchema = z.object({
  ...commonSourceFields,
  sourceType: z.literal("snapshot"),
  sourceUrl: z.url(),
  repository: z.never().optional(),
  commit: z.never().optional(),
  files: z.array(pinnedSnapshotFileSchema).min(1),
});

const curatedSourceManifestSchema = z.object({
  ...commonSourceFields,
  sourceType: z.literal("curated"),
  sourceUrl: z.url(),
  repository: z.never().optional(),
  commit: z.never().optional(),
  files: z.array(curatedFileSchema).min(1),
});

const typedSourceManifestSchema = z
  .discriminatedUnion("sourceType", [
    gitSourceManifestSchema,
    snapshotSourceManifestSchema,
    curatedSourceManifestSchema,
  ])
  .superRefine((source, context) => {
    if (
      source.releaseEligible &&
      (source.reviewStatus !== "verified" || source.license.spdx === "UNKNOWN")
    ) {
      context.addIssue({
        code: "custom",
        message: "Release-eligible sources must be verified with a known license",
      });
    }
    if (
      source.personalEligible &&
      !["source_checked", "verified"].includes(source.reviewStatus)
    ) {
      context.addIssue({
        code: "custom",
        message: "Personal sources must be source-checked with a known license",
      });
    }
    if (source.personalEligible && source.license.spdx === "UNKNOWN") {
      context.addIssue({
        code: "custom",
        message: "Personal sources must be source-checked with a known license",
      });
    }
    if (source.reviewStatus === "source_checked" && source.releaseEligible) {
      context.addIssue({
        code: "custom",
        message: "Source-checked personal sources cannot be production release eligible",
      });
    }
  });

export const sourceManifestSchema = z.preprocess((input) => {
  if (typeof input !== "object" || input === null || "sourceType" in input) return input;
  return { ...input, sourceType: "git" };
}, typedSourceManifestSchema);

export type SourceManifest = z.infer<typeof sourceManifestSchema>;

function pathIsAbsolute(value: string): boolean {
  return /^(?:[a-zA-Z]:[\\/]|[\\/])/u.test(value);
}
