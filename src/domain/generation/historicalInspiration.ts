import type { RuntimeBundle } from "../../data/schema/runtimeBundle";
import type { NamingProfile } from "../project/profile";
import type { GeneratedCandidate } from "./generateCandidates";
import { toSimplifiedText } from "../candidate/toSimplifiedText";

/** Only explicit, reviewed personal records with a known single surname are split. */
export function historicalInspirationDrafts(
  profile: NamingProfile,
  bundle: RuntimeBundle,
): GeneratedCandidate[] {
  const cards = new Map(bundle.characters.map((c) => [c.char, c]));
  const drafts: GeneratedCandidate[] = [];
  // The current collection contains these surnames. Unknown/compound names stay ungenerated.
  const knownSurnames = new Set([..."刘翁林王黄陈吴张陆梁洪孙赵曹崇骆夏"]);
  for (const person of bundle.personUsages) {
    if (
      person.identityType !== "zhuangyuan" ||
      (bundle.manifest.status !== "personal" && person.reviewStatus !== "verified")
    )
      continue;
    const name = toSimplifiedText(person.name, bundle.traditionalToSimplified);
    if (!knownSurnames.has(name[0]!) || name.length < 2 || name.length > 3) continue;
    const original = name.slice(1);
    const borrowed = [...original].filter((char) => cards.has(char));
    const options = new Set<string>();
    if (original.length === profile.givenNameLength) options.add(original);
    for (const char of borrowed) {
      if (profile.givenNameLength === 1) options.add(char);
      else
        for (const pair of bundle.modernCombinations ?? [])
          if (pair.givenName.includes(char)) options.add(pair.givenName);
    }
    for (const givenName of options) {
      const relation =
        givenName === original
          ? `沿用名中“${original}”，替换姓氏`
          : `借用原名“${original}”中的“${[...givenName].filter((c) => original.includes(c)).join("、")}”，与当代字义组合“${givenName}”相接`;
      const entries = [...givenName].map((char) => cards.get(char));
      if (entries.some((c) => !c)) continue;
      const fullName = profile.surname + givenName;
      drafts.push({
        id: `candidate:${fullName}`,
        projectId: profile.projectId,
        batchId: null,
        normalizedFingerprint: fullName.normalize("NFC"),
        surname: profile.surname,
        givenName,
        fullName,
        pinyin: entries.map((c) => c!.pinyin[0]!),
        sourceType: "historical_inspiration",
        summary: `取${person.period}状元${person.name}名中取字作为灵感；${entries.map((c) => c!.meanings[0]).join("；")}。此为当代取意，不推断原名命名缘由。`,
        sourceIds: person.sourceRefs.map((s) => s.sourceId),
        sourceEvidence: person.sourceRefs.map((s) => ({
          sourceId: s.sourceId,
          location: s.location,
          ...(s.url ? { url: s.url } : {}),
          title: `${person.name} · 状元用名`,
          work: person.period,
          excerpt: `${person.rankEvidence}；关系：${relation}。${person.reviewStatus === "verified" ? "人工核验" : "来源核对，未经专家逐条复审"}，核对日期 ${person.checkedAt}。不表示功名或人生结果。`,
        })),
        warnings: entries.flatMap((c) => c!.risks),
        riskSignals: entries.flatMap((c) => c!.riskSignals),
        ruleResults: [],
        styleTags: ["文雅书卷"],
        characterElements: entries.flatMap((c) => (c!.element ? [c!.element] : [])),
        characterEvidence: entries.map((c) => ({
          char: c!.char,
          pinyin: c!.pinyin,
          meanings: c!.meanings,
          sourceRefs: c!.sourceRefs.map((s) => s.sourceId),
        })),
        createdAt: "1970-01-01T00:00:00.000Z",
      });
    }
  }
  return drafts;
}
