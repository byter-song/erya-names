import { z } from "zod";

const singleNfcCharacterSchema = z
  .string()
  .refine(
    (value) => [...value].length === 1 && value === value.normalize("NFC"),
    "Expected one NFC-normalized character",
  );

const sourceRefSchema = z.object({
  sourceId: z.string().min(1),
  location: z.string().min(1),
  excerpt: z.string().optional(),
  url: z.url().optional(),
  revision: z.string().min(1).optional(),
});

export const reviewedRiskSignalSchema = z.object({
  kind: z.enum([
    "negative_meaning",
    "known_homophone",
    "multiple_pronunciation",
    "input",
    "writing",
  ]),
  outcome: z.enum(["warn", "reject"]),
  explanation: z.string().min(1),
  sourceRefs: z.array(z.string().min(1)).min(1),
  reviewStatus: z.literal("verified"),
});

export const runtimeCharacterSchema = z.object({
  char: z.string().length(1),
  pinyin: z.array(z.string().min(1)).min(1),
  meanings: z.array(z.string().min(1)).min(1),
  styleTags: z.array(z.string().min(1)),
  risks: z.array(z.string()),
  riskSignals: z.array(reviewedRiskSignalSchema).default([]),
  reviewStatus: z.enum(["verified", "source_checked"]),
  strokes: z.number().int().positive().optional(),
  genderExpression: z.enum(["neutral", "masculine", "feminine"]).optional(),
  element: z.enum(["wood", "fire", "earth", "metal", "water"]).optional(),
  elementReason: z.string().optional(),
  elementEvidence: z
    .object({
      methodVersion: z.string().min(1),
      reviewStatus: z.enum(["source_checked", "verified"]),
      checkedAt: z.iso.date(),
      sourceRefs: z.array(z.string().min(1)).min(1),
    })
    .optional(),
  checkedAt: z.string().optional(),
  sourceRefs: z.array(sourceRefSchema).min(1),
});

export const corpusScoreSchema = z.object({
  total: z.number().min(0).max(100),
  threshold: z.number().min(0).max(100),
  accepted: z.boolean(),
  deductions: z.array(
    z.object({
      id: z.string().min(1),
      points: z.number().nonnegative(),
      explanation: z.string().min(1),
    }),
  ),
  modelVersion: z.string().min(1),
});

export const runtimeAllusionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  work: z.string().min(1),
  quote: z.string().min(1),
  selectedText: z.string().min(1).max(2),
  interpretation: z.string().min(1),
  styleTags: z.array(z.string().min(1)),
  risks: z.array(z.string()),
  riskSignals: z.array(reviewedRiskSignalSchema).default([]),
  reviewStatus: z.enum(["verified", "source_checked"]),
  checkedAt: z.string().optional(),
  sourceRefs: z.array(sourceRefSchema).min(1),
  corpusScore: corpusScoreSchema.optional(),
});

const personUsageSourceRefSchema = z.object({
  sourceId: z.string().min(1),
  location: z.string().min(1),
  url: z.url().optional(),
});

const personUsageBaseSchema = z.object({
  id: z.string().min(1),
  name: z
    .string()
    .regex(/^\p{Script=Han}{2,4}$/u, "Person name must contain 2 to 4 Han characters")
    .refine((name) => name === name.normalize("NFC"), "Person name must be NFC-normalized"),
  period: z.string().min(1),
  description: z.string().min(1),
  sourceRefs: z.array(personUsageSourceRefSchema).min(1),
  reviewStatus: z.enum(["source_checked", "verified"]),
  checkedAt: z.iso.date(),
});

const historicalPersonUsageSchema = personUsageBaseSchema.extend({
  identityType: z.literal("historical_person"),
  rankEvidence: z.never().optional(),
});

const imperialExamPersonUsageSchema = personUsageBaseSchema.extend({
  identityType: z.enum(["zhuangyuan", "bangyan", "tanhua", "jinshi"]),
  rankEvidence: z.string().min(1),
});

export const personUsageSchema = z.discriminatedUnion("identityType", [
  historicalPersonUsageSchema,
  imperialExamPersonUsageSchema,
]);

export const modernCombinationSchema = z
  .object({
    givenName: z.string().length(2),
    meaning: z.string().min(10).max(160),
    styleTags: z
      .array(z.enum(["清朗自然", "文雅书卷", "沉稳端正", "中性现代", "温婉灵秀"]))
      .min(1)
      .max(2),
    usageNote: z.string().min(5).max(160),
    genderExpression: z.enum(["neutral", "masculine", "feminine"]),
  })
  .strict();

export type RuntimeModernCombination = z.infer<typeof modernCombinationSchema>;

export const runtimeBundleSchema = z.object({
  manifest: z.object({
    version: z.string().min(1),
    status: z.enum(["development", "personal", "production"]),
    builtAt: z.iso.datetime(),
    contentHash: z.string().min(1),
  }),
  characters: z.array(runtimeCharacterSchema),
  allusions: z.array(runtimeAllusionSchema),
  modernCombinations: z.array(modernCombinationSchema).optional(),
  standardCharacterPinyin: z
    .record(singleNfcCharacterSchema, z.array(z.string().min(1)).min(1))
    .default({}),
  traditionalToSimplified: z
    .record(singleNfcCharacterSchema, singleNfcCharacterSchema)
    .default({}),
  personUsages: z.array(personUsageSchema).default([]),
});

export type RuntimeBundle = z.infer<typeof runtimeBundleSchema>;
export type RuntimeCharacter = z.infer<typeof runtimeCharacterSchema>;
export type RuntimeAllusion = z.infer<typeof runtimeAllusionSchema>;
export type PersonUsage = z.infer<typeof personUsageSchema>;
export type ReviewedRiskSignal = z.infer<typeof reviewedRiskSignalSchema>;
