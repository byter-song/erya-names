import { describe, expect, it } from "vitest";
import devBundle from "../../../src/data/curated/dev-bundle.json";
import sourceManifest from "../../../data/sources/source-manifest.json";
import {
  personUsageSchema,
  runtimeAllusionSchema,
  runtimeBundleSchema,
} from "../../../src/data/schema/runtimeBundle";

describe("runtime curated bundle", () => {
  it("contains only reviewed characters and allusions", () => {
    const bundle = runtimeBundleSchema.parse(devBundle);

    expect(bundle.manifest.status).toBe("development");
    expect(bundle.characters.length).toBeGreaterThanOrEqual(10);
    expect(bundle.allusions.length).toBeGreaterThanOrEqual(5);
    expect(bundle.characters.every((entry) => entry.reviewStatus === "verified")).toBe(true);
    expect(bundle.allusions.every((entry) => entry.reviewStatus === "verified")).toBe(true);
    expect(bundle.characters.find((entry) => entry.char === "行")?.riskSignals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "multiple_pronunciation",
          outcome: "warn",
          reviewStatus: "verified",
        }),
      ]),
    );
  });

  it("rejects a reviewed risk signal without source evidence", () => {
    const unsafeBundle = structuredClone(devBundle);
    const firstCharacter = unsafeBundle.characters[0];
    if (!firstCharacter) throw new Error("Expected a character fixture");
    firstCharacter.riskSignals = [
      {
        kind: "writing",
        outcome: "warn",
        explanation: "测试风险",
        sourceRefs: [],
        reviewStatus: "verified",
      },
    ];

    expect(() => runtimeBundleSchema.parse(unsafeBundle)).toThrow();
  });

  it("resolves every reviewed risk source through the source manifest", () => {
    const bundle = runtimeBundleSchema.parse(devBundle);
    const sourceIds = new Set(sourceManifest.sources.map((source) => source.sourceId));
    const riskSourceIds = [...bundle.characters, ...bundle.allusions].flatMap((entry) =>
      entry.riskSignals.flatMap((risk) => risk.sourceRefs),
    );

    expect(riskSourceIds.length).toBeGreaterThan(0);
    expect(riskSourceIds.every((sourceId) => sourceIds.has(sourceId))).toBe(true);
  });

  it("requires every top-level dataset required by the current runtime", () => {
    const parsed = runtimeBundleSchema.parse(devBundle);
    expect(parsed.personUsages).toEqual([]);
    expect(parsed.standardCharacterPinyin).toEqual({});
    expect(parsed.traditionalToSimplified).toEqual({});
    expect(() =>
      runtimeBundleSchema.parse({ ...devBundle, personUsages: undefined }),
    ).toThrow();
  });

  it("requires explicit rank evidence for every imperial-exam identity", () => {
    const base = {
      id: "person:test",
      name: "测试名",
      period: "清·某年",
      description: "测试记录。",
      sourceRefs: [{ sourceId: "manual-imperial-exam-curation", location: "测试卷次" }],
      reviewStatus: "source_checked" as const,
      checkedAt: "2026-09-30",
    };

    expect(() => personUsageSchema.parse({ ...base, identityType: "jinshi" })).toThrow();
    expect(
      personUsageSchema.parse({
        ...base,
        identityType: "jinshi",
        rankEvidence: "殿试三甲第四十二名。",
      }),
    ).toMatchObject({ identityType: "jinshi", rankEvidence: "殿试三甲第四十二名。" });
    expect(() =>
      personUsageSchema.parse({
        ...base,
        identityType: "historical_person",
        rankEvidence: "不应存在的名次推断",
      }),
    ).toThrow();
  });

  it("requires person names to be NFC-normalized 2-4 character Han names", () => {
    const base = {
      id: "person:test",
      period: "测试时期",
      identityType: "historical_person" as const,
      description: "测试记录。",
      sourceRefs: [{ sourceId: "test-source", location: "test-location" }],
      reviewStatus: "source_checked" as const,
      checkedAt: "2026-09-30",
    };

    expect(personUsageSchema.parse({ ...base, name: "王安石" }).name).toBe("王安石");
    expect(() => personUsageSchema.parse({ ...base, name: "王" })).toThrow();
    expect(() => personUsageSchema.parse({ ...base, name: "欧阳司马光" })).toThrow();
    expect(() => personUsageSchema.parse({ ...base, name: "王An" })).toThrow();
    expect(() => personUsageSchema.parse({ ...base, name: "神安" })).toThrow(
      "Person name must be NFC-normalized",
    );
  });

  it("accepts a bounded optional corpus score and preserves source links", () => {
    const allusion = structuredClone(devBundle.allusions[0]);
    if (!allusion) throw new Error("Expected an allusion fixture");
    const parsed = runtimeAllusionSchema.parse({
      ...allusion,
      sourceRefs: [
        {
          ...allusion.sourceRefs[0],
          url: "https://example.com/source",
          revision: "commit:abc123",
        },
      ],
      corpusScore: {
        total: 86,
        threshold: 80,
        accepted: true,
        deductions: [{ id: "context", points: 4, explanation: "上下文需人工复核" }],
        modelVersion: "corpus-v1",
      },
    });

    expect(parsed.corpusScore?.total).toBe(86);
    expect(parsed.sourceRefs[0]).toMatchObject({
      url: "https://example.com/source",
      revision: "commit:abc123",
    });
    expect(() =>
      runtimeAllusionSchema.parse({
        ...allusion,
        corpusScore: {
          total: 101,
          threshold: 80,
          accepted: true,
          deductions: [],
          modelVersion: "corpus-v1",
        },
      }),
    ).toThrow();
  });
});
