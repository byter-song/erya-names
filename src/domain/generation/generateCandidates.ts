import { historicalInspirationDrafts } from "./historicalInspiration";
import { evaluateFullNameSound } from "../rules/l2/fullNameSound";
import { readSurname, toneOf } from "../candidate/nameReading";
import type {
  RuntimeAllusion,
  RuntimeBundle,
  RuntimeCharacter,
  RuntimeModernCombination,
} from "../../data/schema/runtimeBundle";
import type { Candidate } from "../candidate/candidate";
import type { CandidateSourceEvidence } from "../candidate/sourceEvidence";
import type { NamingProfile } from "../project/profile";
import { evaluateCandidateRules } from "../rules/rulePack";
import type { CandidateRuleResult } from "../rules/types";
import { scoreCandidatePreferences } from "../rules/l3/scoreCandidatePreferences";
import { calculateSystemScore } from "../rules/scoring/systemScore";
import { toSimplifiedText } from "../candidate/toSimplifiedText";

export interface GeneratedCandidate extends Candidate {
  sourceIds: string[];
  sourceEvidence: CandidateSourceEvidence[];
  warnings: string[];
  riskSignals: RuntimeCharacter["riskSignals"];
  ruleResults: CandidateRuleResult[];
  styleTags: string[];
  characterElements: Array<"wood" | "fire" | "earth" | "metal" | "water">;
  characterEvidence: Array<{
    char: string;
    pinyin: string[];
    meanings: string[];
    sourceRefs: string[];
  }>;
}

export interface GenerateCandidatesResult {
  candidates: GeneratedCandidate[];
  statistics: {
    sourceCandidates: number;
    hardRejected: number;
    duplicateRejected: number;
    historicalRejected: number;
    persisted: number;
  };
}

export function generateCandidates(input: {
  profile: NamingProfile;
  bundle: RuntimeBundle;
  seed: string;
  requestedCount: number;
  allusionRatio: number;
  historicalFingerprints: Set<string>;
}): GenerateCandidatesResult {
  if (
    !Number.isInteger(input.requestedCount) ||
    input.requestedCount < 1 ||
    input.requestedCount > 200
  )
    throw new Error("每批数量应为 1–200");
  if (
    !Number.isFinite(input.allusionRatio) ||
    input.allusionRatio < 0 ||
    input.allusionRatio > 1
  )
    throw new Error("典故比例应为 0–1");
  const sources = input.profile.inspirationSources ?? ["poetry", "modern"];
  const characters = new Map(input.bundle.characters.map((entry) => [entry.char, entry]));
  const allusionDrafts = input.bundle.allusions
    .filter(
      (entry) =>
        (entry.reviewStatus === "verified" || input.bundle.manifest.status === "personal") &&
        entry.corpusScore?.accepted !== false,
    )
    .map((allusion) =>
      fromAllusion(allusion, input.profile, characters, input.bundle.traditionalToSimplified),
    );
  const eligibleCharacters = input.bundle.characters.filter(
    (entry) => entry.reviewStatus === "verified" || input.bundle.manifest.status === "personal",
  );
  const modernCombinations =
    input.bundle.manifest.status === "personal" ? (input.bundle.modernCombinations ?? []) : [];
  const modernByName = new Map(modernCombinations.map((item) => [item.givenName, item]));
  const compositionDrafts = composeCharacters(
    input.profile,
    seededShuffle(eligibleCharacters, input.seed),
    seededShuffle(modernCombinations, `${input.seed}:editorial`),
  );
  const historicalDrafts = sources.includes("historical")
    ? historicalInspirationDrafts(input.profile, input.bundle)
    : [];
  const sourceCandidates =
    (sources.includes("poetry") ? allusionDrafts.length : 0) +
    historicalDrafts.length +
    (sources.includes("modern")
      ? input.profile.givenNameLength === 1
        ? eligibleCharacters.length
        : eligibleCharacters.length * (eligibleCharacters.length - 1)
      : 0);
  let hardRejected = 0;
  let historicalRejected = 0;
  const applyRules = (candidate: GeneratedCandidate) => {
    const evaluation = evaluateCandidateRules({
      candidate,
      profile: input.profile,
      bundle: input.bundle,
    });
    if (!evaluation.accepted) {
      hardRejected += 1;
      return undefined;
    }
    const fullNameWarnings = evaluateFullNameSound(
      input.profile.surname,
      candidate.pinyin,
      input.profile.surnamePinyin,
    );
    const l3 = scoreCandidatePreferences({
      pinyin: candidate.pinyin,
      sourceType: candidate.sourceType,
      characterStyleTags: candidate.styleTags,
      preferredStyleTags: input.profile.styleTags,
      pinyinFriendly: input.profile.pinyinFriendly,
    });
    const l3Results: CandidateRuleResult[] = l3.dimensions.map((dimension) => ({
      evidenceLevel: "L3",
      outcome: dimension.outcome === "unknown" ? "unknown" : "pass",
      ruleId: `l3-${dimension.id}`,
      ruleVersion: dimension.id === "score-base" ? "system-score-1" : "preference-score-3",
      explanation: dimension.evidence,
      sourceRefs: dimension.id === "score-base" ? [] : candidate.sourceIds,
      scoreDelta: dimension.scoreDelta,
    }));
    const tones = [
      ...readSurname(input.profile.surname, input.profile.surnamePinyin),
      ...candidate.pinyin,
    ].map(toneOf);
    if (tones.every((tone) => tone !== undefined))
      l3Results.push({
        evidenceLevel: "L3",
        outcome: "pass",
        ruleId: "l3-tone-flow",
        ruleVersion: "preference-score-3",
        sourceRefs: ["pinyin-data"],
        explanation: `全名本调 ${tones.map((tone) => (tone === 0 ? "轻声" : `${tone}声`)).join(" → ")}；声调起伏属于审美偏好，不是语言优劣。`,
        scoreDelta: new Set(tones).size > 1 ? 2 : 0,
      });
    if (candidate.sourceType === "modern_combination" && modernByName.has(candidate.givenName))
      l3Results.push({
        evidenceLevel: "L3",
        outcome: "pass",
        ruleId: "l3-combination",
        ruleVersion: "preference-score-3",
        sourceRefs: ["erya-original-20260927"],
        explanation: "来自项目编辑整理的现代组合，优先考虑搭配自然与日常叫名；不宣称古籍出处。",
        scoreDelta: 5,
      });
    const cards = [...candidate.givenName].map((char) => characters.get(char));
    const strokeCounts = cards.map((card) => card?.strokes);
    const knownStrokes = strokeCounts.every((count): count is number => count !== undefined);
    if (knownStrokes)
      l3Results.push({
        evidenceLevel: "L3",
        outcome: "pass",
        ruleId: "l3-writing",
        ruleVersion: "preference-score-3",
        sourceRefs: ["unihan-17"],
        explanation: `简体笔画 ${strokeCounts.join(" + ")}；书写偏好：${input.profile.writingComplexity === "simple" ? "简洁" : input.profile.writingComplexity === "balanced" ? "均衡" : "不限"}`,
        scoreDelta:
          input.profile.writingComplexity === "simple"
            ? Math.max(-6, 6 - Math.max(...strokeCounts))
            : input.profile.writingComplexity === "balanced"
              ? Math.max(
                  0,
                  3 -
                    Math.abs(
                      (strokeCounts[0] ?? 0) - (strokeCounts[1] ?? strokeCounts[0] ?? 0),
                    ),
                )
              : 0,
      });
    const expression = modernByName.get(candidate.givenName)?.genderExpression;
    const preferredExpression =
      input.profile.genderExpression !== "unrestricted"
        ? input.profile.genderExpression
        : input.profile.childGender === "male"
          ? "masculine"
          : input.profile.childGender === "female"
            ? "feminine"
            : undefined;
    if (preferredExpression)
      l3Results.push({
        evidenceLevel: "L3",
        outcome: "pass",
        ruleId: "l3-expression",
        ruleVersion: "preference-score-3",
        sourceRefs: ["erya-original-20260927"],
        explanation:
          input.profile.genderExpression === "unrestricted"
            ? "按宝宝性别提供默认文字表达软排序；仅作起名参照，不限制跨性别使用。"
            : "按所选阳刚、柔美或中性的文字表达偏好排序；仅为编辑风格标签，不限制任何性别使用。",
        scoreDelta: expression
          ? expression === preferredExpression
            ? 4
            : 0
          : cards.filter((card) => card?.genderExpression === preferredExpression).length * 2,
      });
    return {
      ...candidate,
      ruleResults: [
        ...candidate.ruleResults,
        ...evaluation.results,
        ...fullNameWarnings,
        ...l3Results,
      ],
    };
  };
  const acceptedHistorical = sources.includes("historical")
    ? historicalDrafts.map(applyRules).filter((c): c is GeneratedCandidate => c !== undefined)
    : [];
  const acceptedAllusions = (sources.includes("poetry") ? allusionDrafts : [])
    .map(applyRules)
    .filter((candidate): candidate is GeneratedCandidate => candidate !== undefined);
  // Sample across the whole alphabet before ranking; never build an O(n²) array of rich records.
  const acceptedCompositions: GeneratedCandidate[] = [];
  for (const draft of sources.includes("modern") ? compositionDrafts : []) {
    if (input.historicalFingerprints.has(draft.normalizedFingerprint)) {
      historicalRejected++;
      continue;
    }
    const accepted = applyRules(draft);
    if (accepted) acceptedCompositions.push(accepted);
    if (acceptedCompositions.length >= Math.max(400, input.requestedCount * 12)) break;
  }
  const rank = (candidate: GeneratedCandidate) => calculateSystemScore(candidate.ruleResults);
  const uniqueAllusions = new Map<string, GeneratedCandidate>();
  for (const item of acceptedAllusions) {
    if (input.historicalFingerprints.has(item.normalizedFingerprint)) {
      historicalRejected++;
      continue;
    }
    const existing = uniqueAllusions.get(item.fullName);
    if (existing) {
      existing.sourceEvidence.push(...item.sourceEvidence);
      existing.sourceIds = [...new Set([...existing.sourceIds, ...item.sourceIds])];
    } else uniqueAllusions.set(item.fullName, item);
  }
  const orderedAllusions = seededShuffle(
    [...uniqueAllusions.values()],
    `${input.seed}:allusions`,
  ).sort((a, b) => rank(b) - rank(a));
  const allusionNames = new Set(acceptedAllusions.map((item) => item.fullName));
  const orderedCompositions = seededShuffle(
    acceptedCompositions.filter((item) => !allusionNames.has(item.fullName)),
    `${input.seed}:compositions`,
  ).sort((a, b) => rank(b) - rank(a));
  const allusionTarget = Math.min(
    orderedAllusions.length,
    Math.max(0, Math.round(input.requestedCount * input.allusionRatio)),
  );
  const uniqueHistorical = new Map<string, GeneratedCandidate>();
  for (const item of acceptedHistorical) {
    const existing = uniqueHistorical.get(item.fullName);
    if (existing) {
      existing.sourceEvidence.push(...item.sourceEvidence);
      existing.sourceIds = [...new Set([...existing.sourceIds, ...item.sourceIds])];
    } else uniqueHistorical.set(item.fullName, item);
  }
  const historical = seededShuffle([...uniqueHistorical.values()], `${input.seed}:historical`);
  const historicalTarget =
    sources.length === 1
      ? input.requestedCount
      : Math.ceil(input.requestedCount / sources.length);
  const preferred = [
    ...historical.slice(0, historicalTarget),
    ...orderedAllusions.slice(0, allusionTarget),
    ...orderedCompositions,
    ...orderedAllusions.slice(allusionTarget),
    ...historical.slice(historicalTarget),
  ];
  const candidates: GeneratedCandidate[] = [];
  const seen = new Set<string>();
  let duplicateRejected = 0;

  for (const candidate of preferred) {
    if (input.historicalFingerprints.has(candidate.normalizedFingerprint)) {
      historicalRejected += 1;
      continue;
    }
    if (seen.has(candidate.normalizedFingerprint)) {
      duplicateRejected += 1;
      continue;
    }
    seen.add(candidate.normalizedFingerprint);
    candidates.push(candidate);
    if (candidates.length >= input.requestedCount) break;
  }

  return {
    candidates,
    statistics: {
      sourceCandidates,
      hardRejected,
      duplicateRejected,
      historicalRejected,
      persisted: candidates.length,
    },
  };
}

function fromAllusion(
  allusion: RuntimeAllusion,
  profile: NamingProfile,
  characters: Map<string, RuntimeCharacter>,
  traditionalToSimplified: Readonly<Record<string, string>>,
): GeneratedCandidate {
  const simplify = (value: string) => toSimplifiedText(value, traditionalToSimplified);
  const givenName = simplify(allusion.selectedText);
  const entries = [...givenName].map((char) => characters.get(char));

  return createCandidate({
    profile,
    givenName,
    sourceType: "verified_allusion",
    summary: simplify(allusion.interpretation),
    sourceIds: allusion.sourceRefs.map((source) => source.sourceId),
    sourceEvidence: allusion.sourceRefs.map((source) => ({
      sourceId: source.sourceId,
      title: simplify(allusion.title),
      work: simplify(allusion.work),
      quote: simplify(allusion.quote),
      location: simplify(source.location),
      ...(source.excerpt ? { excerpt: simplify(source.excerpt) } : {}),
      ...(source.url ? { url: source.url } : {}),
      ...(source.revision ? { revision: source.revision } : {}),
    })),
    warnings: [
      ...allusion.risks.map(simplify),
      ...entries.flatMap((entry) => entry?.risks.map(simplify) ?? []),
    ],
    riskSignals: [
      ...allusion.riskSignals,
      ...entries.flatMap((entry) => entry?.riskSignals ?? []),
    ].map((signal) => ({ ...signal, explanation: simplify(signal.explanation) })),
    styleTags: allusion.styleTags,
    characterElements: entries.flatMap((entry) => (entry?.element ? [entry.element] : [])),
    characterEvidence: entries.flatMap((entry) =>
      entry
        ? [
            {
              char: entry.char,
              pinyin: entry.pinyin,
              meanings: entry.meanings,
              sourceRefs: entry.sourceRefs.map((source) => source.sourceId),
            },
          ]
        : [],
    ),
    pinyin: entries.flatMap((entry) => entry?.pinyin[0] ?? []),
    initialRuleResults: allusion.corpusScore
      ? [
          {
            evidenceLevel: "L3",
            outcome: "pass",
            ruleId: "l3-corpus-quality",
            ruleVersion: allusion.corpusScore.modelVersion,
            explanation: `精选语料准入 ${allusion.corpusScore.total}/100；${allusion.corpusScore.deductions.map((item) => `${item.explanation}（-${item.points}）`).join("；") || "没有语料扣分项"}`,
            sourceRefs: allusion.sourceRefs.map((source) => source.sourceId),
            scoreDelta: -Math.ceil((100 - allusion.corpusScore.total) / 5),
          },
        ]
      : [],
  });
}

function* composeCharacters(
  profile: NamingProfile,
  entries: RuntimeCharacter[],
  modernCombinations: RuntimeModernCombination[],
): Generator<GeneratedCandidate> {
  const contextualOnly = new Set([..."离故独物审止身既好皋猗舜桢见格约辨则旗与知仁修至致"]);
  const required = new Set(profile.requiredCharacters.map((item) => item.char));
  const verified = entries.filter(
    (entry) =>
      !profile.avoidCharacters.includes(entry.char) &&
      (!contextualOnly.has(entry.char) ||
        required.has(entry.char) ||
        profile.givenNameLength === 1),
  );
  if (profile.givenNameLength === 1) {
    for (const entry of verified) {
      yield createCandidate({
        profile,
        givenName: entry.char,
        sourceType: "modern_combination",
        summary: entry.meanings.join("；"),
        sourceIds: entry.sourceRefs.map((source) => source.sourceId),
        sourceEvidence: entry.sourceRefs.map((source) => ({
          sourceId: source.sourceId,
          location: source.location,
          ...(source.excerpt ? { excerpt: source.excerpt } : {}),
        })),
        warnings: entry.risks,
        riskSignals: entry.riskSignals,
        styleTags: entry.styleTags,
        characterElements: entry.element ? [entry.element] : [],
        characterEvidence: [
          {
            char: entry.char,
            pinyin: entry.pinyin,
            meanings: entry.meanings,
            sourceRefs: entry.sourceRefs.map((source) => source.sourceId),
          },
        ],
        pinyin: [entry.pinyin[0] ?? entry.char],
      });
    }
    return;
  }

  const byChar = new Map(entries.map((entry) => [entry.char, entry]));
  const editorialNames = new Set(modernCombinations.map((item) => item.givenName));
  for (const combination of modernCombinations) {
    const pair = combination.givenName;
    const first = byChar.get(pair[0]!);
    const second = byChar.get(pair[1]!);
    if (!first || !second) continue;
    yield createCandidate({
      profile,
      givenName: pair,
      sourceType: "modern_combination",
      summary: combination.meaning,
      sourceIds: [
        "erya-modern-20260927",
        ...new Set(
          [...first.sourceRefs, ...second.sourceRefs].map((source) => source.sourceId),
        ),
      ],
      sourceEvidence: [
        {
          sourceId: "erya-modern-20260927",
          location: combination.givenName,
          excerpt: combination.usageNote,
        },
        ...[...first.sourceRefs, ...second.sourceRefs].map((source) => ({
          sourceId: source.sourceId,
          location: source.location,
          ...(source.excerpt ? { excerpt: source.excerpt } : {}),
        })),
      ],
      warnings: [...first.risks, ...second.risks],
      riskSignals: [...first.riskSignals, ...second.riskSignals],
      styleTags: combination.styleTags,
      characterElements: [first, second].flatMap((entry) =>
        entry.element ? [entry.element] : [],
      ),
      characterEvidence: [first, second].map((entry) => ({
        char: entry.char,
        pinyin: entry.pinyin,
        meanings: entry.meanings,
        sourceRefs: entry.sourceRefs.map((source) => source.sourceId),
      })),
      pinyin: [first.pinyin[0]!, second.pinyin[0]!],
    });
  }
  for (let offset = 1; offset < verified.length; offset++) {
    for (let index = 0; index < verified.length; index++) {
      const first = verified[index]!;
      const second = verified[(index + offset) % verified.length]!;
      const givenName = `${first.char}${second.char}`;
      if (editorialNames.has(givenName)) continue;
      if ("子亦以予之允惟".includes(second.char) && !required.has(second.char)) continue;
      if (
        profile.requiredCharacters.some(({ char, position }) =>
          position === "any" ? !givenName.includes(char) : givenName[position - 1] !== char,
        )
      )
        continue;
      yield createCandidate({
        profile,
        givenName,
        sourceType: "modern_combination",
        summary: `${first.meanings[0]}；${second.meanings[0]}`,
        sourceIds: [
          ...new Set(
            [...first.sourceRefs, ...second.sourceRefs].map((source) => source.sourceId),
          ),
        ],
        sourceEvidence: [...first.sourceRefs, ...second.sourceRefs].map((source) => ({
          sourceId: source.sourceId,
          location: source.location,
          ...(source.excerpt ? { excerpt: source.excerpt } : {}),
        })),
        warnings: [...first.risks, ...second.risks],
        riskSignals: [...first.riskSignals, ...second.riskSignals],
        styleTags: [...new Set([...first.styleTags, ...second.styleTags])],
        characterElements: [first, second].flatMap((entry) =>
          entry.element ? [entry.element] : [],
        ),
        characterEvidence: [first, second].map((entry) => ({
          char: entry.char,
          pinyin: entry.pinyin,
          meanings: entry.meanings,
          sourceRefs: entry.sourceRefs.map((source) => source.sourceId),
        })),
        pinyin: [first.pinyin[0] ?? first.char, second.pinyin[0] ?? second.char],
      });
    }
  }
}

function createCandidate(input: {
  profile: NamingProfile;
  givenName: string;
  sourceType: GeneratedCandidate["sourceType"];
  summary: string;
  sourceIds: string[];
  sourceEvidence: CandidateSourceEvidence[];
  warnings: string[];
  riskSignals: RuntimeCharacter["riskSignals"];
  styleTags: string[];
  characterElements: Array<"wood" | "fire" | "earth" | "metal" | "water">;
  characterEvidence: GeneratedCandidate["characterEvidence"];
  pinyin: string[];
  initialRuleResults?: CandidateRuleResult[];
}): GeneratedCandidate {
  const fullName = `${input.profile.surname}${input.givenName}`;
  return {
    id: `candidate:${fullName}`,
    projectId: input.profile.projectId,
    batchId: null,
    normalizedFingerprint: fullName.normalize("NFC"),
    surname: input.profile.surname,
    givenName: input.givenName,
    fullName,
    pinyin: input.pinyin,
    sourceType: input.sourceType,
    summary: input.summary,
    sourceIds: input.sourceIds,
    sourceEvidence: input.sourceEvidence,
    warnings: [...new Set(input.warnings)],
    riskSignals: input.riskSignals,
    styleTags: input.styleTags,
    characterElements: input.characterElements,
    characterEvidence: input.characterEvidence,
    ruleResults: input.initialRuleResults ?? [],
    createdAt: "1970-01-01T00:00:00.000Z",
  };
}

function seededShuffle<Value>(values: Value[], seed: string): Value[] {
  let state = hashSeed(seed);
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const target = state % (index + 1);
    [result[index], result[target]] = [result[target] as Value, result[index] as Value];
  }
  return result;
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (const char of seed) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
