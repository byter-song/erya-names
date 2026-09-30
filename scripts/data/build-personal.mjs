import { format } from "prettier";
import prettierConfig from "../../prettier.config.js";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { scoreAllusionRecord } from "./corpusScoring.mjs";
const read = (name) =>
  readFileSync(new URL(`../../data/sources/personal/${name}`, import.meta.url), "utf8");
const standard = new Set(
  JSON.parse(
    readFileSync(new URL("../../src/data/curated/standard-characters.json", import.meta.url)),
  ).characters,
);
const pinyin = JSON.parse(read("pinyin-evidence.json"));
const strokes = JSON.parse(read("strokes-evidence.json"));
const overrides = {
  珩: "héng",
  子: "zǐ",
  行: "xíng",
  乐: "lè",
  宁: "níng",
  予: "yǔ",
  朝: "zhāo",
  柏: "bǎi",
  朴: "pǔ",
  藏: "cáng",
  见: "jiàn",
  思: "sī",
  和: "hé",
  琼: "qióng",
};
const feminine = new Set([..."姝淑薇婉妍妤姗姮嫣娴婧曼绮纾颖瑶琳"]);
const masculine = new Set([..."毅弘邦翰鹏岳锐轩"]);
const classics = new Set([..."知德文思令仪徽佩衿秉博笃学礼仁善诚谦谨砚研修志明"]);
const characters = read("characters.tsv")
  .trim()
  .split("\n")
  .map((line) => {
    const [char, meaning, element] = line.split("\t");
    if (!standard.has(char) || !pinyin[char])
      throw new Error(`Missing standard/pinyin evidence: ${char}`);
    const readings = [...new Set([overrides[char] ?? pinyin[char][0], ...pinyin[char]])];
    const natural =
      Boolean(element) ||
      new Set([..."云风月星春夏秋冬雨岚南北东初晴明朗辰鸿鹤鹿遥"]).has(char);
    const risks =
      readings.length > 1
        ? [`${char}有多个收录读音，本包取 ${readings[0]}；作为姓名仍需确认。`]
        : [];
    return {
      char,
      pinyin: readings,
      meanings: [meaning],
      styleTags: [
        ...new Set([
          natural ? "清朗自然" : classics.has(char) ? "文雅书卷" : "中性现代",
          feminine.has(char)
            ? "温婉灵秀"
            : masculine.has(char) || classics.has(char)
              ? "沉稳端正"
              : natural
                ? "清朗自然"
                : "文雅书卷",
        ]),
      ],
      risks,
      riskSignals:
        readings.length > 1
          ? [
              {
                kind: "multiple_pronunciation",
                outcome: "warn",
                explanation: risks[0],
                sourceRefs: ["pinyin-data"],
                reviewStatus: "verified",
              },
            ]
          : [],
      reviewStatus: "source_checked",
      checkedAt: "2026-09-27",
      genderExpression: feminine.has(char)
        ? "feminine"
        : masculine.has(char)
          ? "masculine"
          : "neutral",
      ...(strokes[char] ? { strokes: strokes[char] } : {}),
      ...(element
        ? {
            element,
            elementReason: `按“${meaning}”作字义意象归类；属本项目的文化解释口径，不代表统一的汉字五行标准。`,
          }
        : {}),
      sourceRefs: [
        { sourceId: "standard-hanzi-2013", location: "规范汉字成员校验" },
        {
          sourceId: "pinyin-data",
          location: `pinyin.txt U+${char.codePointAt(0).toString(16).toUpperCase()}`,
        },
        {
          sourceId: "erya-original-20260927",
          location: "独立撰写的取名用字释义；AI 整理，未经专家逐条人审",
        },
        ...(strokes[char]
          ? [{ sourceId: "unihan-17", location: "kTotalStrokes 首个值（简体优先）" }]
          : []),
      ],
    };
  });
const characterSet = new Set(characters.map((x) => x.char));
const allusionInputs = [
  {
    input: "allusions.tsv",
    evidence: "anthology-evidence.json",
    idPrefix: "personal-allusion",
    defaults: { contextRisk: "medium", semanticClarity: 4, nameUsability: 4 },
  },
  {
    input: "s-allusions.tsv",
    evidence: "s-anthology-evidence.json",
    idPrefix: "personal-s-allusion",
  },
  {
    input: "a-allusions.tsv",
    evidence: "a-anthology-evidence.json",
    idPrefix: "personal-a-allusion",
  },
];
const allusions = allusionInputs.flatMap((source) => buildAllusions(source));
const modernCombinations = JSON.parse(
  readFileSync(
    new URL("../../src/data/curated/modern-combinations.json", import.meta.url),
    "utf8",
  ),
);
const personUsages = JSON.parse(read("person-usages.json"));
if (
  modernCombinations.length !== 500 ||
  new Set(modernCombinations.map((item) => item.givenName)).size !== 500
)
  throw new Error("Expected exactly 500 unique modern combinations");
const allusionNames = new Set(allusions.map((item) => item.selectedText));
for (const item of modernCombinations) {
  if (
    [...item.givenName].length !== 2 ||
    [...item.givenName].some((char) => !characterSet.has(char)) ||
    allusionNames.has(item.givenName)
  )
    throw new Error(`Invalid modern combination ${item.givenName}`);
}
const body = { characters, allusions, modernCombinations, personUsages };
const contentHash = createHash("sha256").update(JSON.stringify(body)).digest("hex");
const bundle = {
  manifest: {
    version: "personal-2026.09.30",
    status: "personal",
    builtAt: "2026-09-30T00:00:00.000Z",
    contentHash,
  },
  ...body,
};
writeFileSync(
  new URL("../../src/data/curated/personal-bundle.json", import.meta.url),
  await format(JSON.stringify(bundle), { ...prettierConfig, parser: "json" }),
);
writeFileSync(
  new URL("../../src/data/curated/writing-strokes.json", import.meta.url),
  await format(JSON.stringify(strokes), { ...prettierConfig, parser: "json" }),
);
console.log(
  `Personal corpus: ${characters.length} characters, ${allusions.length} traceable allusions, ${modernCombinations.length} editorial combinations, ${personUsages.length} historical usages, ${characters.filter((x) => x.strokes).length} stroke records. SHA256 ${contentHash}`,
);

function buildAllusions(source) {
  const evidence = JSON.parse(read(source.evidence));
  const lines = read(source.input).trim().split("\n");
  if (evidence.length !== lines.length)
    throw new Error(`${source.input}: evidence count mismatch`);
  return lines.map((line, index) => {
    const [
      selectedText,
      title,
      fragment,
      interpretation,
      risk,
      contextRisk = source.defaults?.contextRisk,
      semanticClarity = source.defaults?.semanticClarity,
      nameUsability = source.defaults?.nameUsability,
    ] = line.split("\t");
    const ref = evidence[index];
    if (!ref || ref.title !== title || !ref.normalizedQuote.includes(fragment))
      throw new Error(`Quote mismatch: ${selectedText}`);
    let pos = -1;
    const cards = [];
    for (const char of selectedText) {
      pos = ref.normalizedQuote.indexOf(char, pos + 1);
      const card = characters.find((entry) => entry.char === char);
      if (pos < 0 || !characterSet.has(char) || !card)
        throw new Error(`Extraction mismatch: ${selectedText}`);
      cards.push(card);
    }
    const corpusScore = scoreAllusionRecord({
      selectedText,
      contextRisk,
      semanticClarity,
      nameUsability,
      ambiguousReadings: cards.filter((card) => card.pinyin.length > 1).length,
      maximumStrokes: Math.max(...cards.map((card) => card.strokes ?? 0)),
    });
    if (!corpusScore.accepted)
      throw new Error(
        `${source.input}:${index + 1} ${selectedText} scored ${corpusScore.total}, below ${corpusScore.threshold}`,
      );
    const work =
      ref.work ??
      {
        shijing: "诗经",
        chuci: "楚辞",
        lunyu: "论语",
        daxue: "大学",
        mengzi: "孟子",
        zhongyong: "中庸",
        "song-300": "宋词三百首",
        "tang-0": "全唐诗",
      }[ref.sourceId.split(":")[1]];
    if (!work) throw new Error(`Missing work mapping: ${ref.sourceId}`);
    return {
      id: `${source.idPrefix}-${index + 1}`,
      title,
      work,
      quote: ref.normalizedQuote,
      selectedText,
      interpretation,
      risks: [risk],
      riskSignals: [
        {
          kind: "input",
          outcome: "warn",
          explanation: risk,
          sourceRefs: [ref.sourceId],
          reviewStatus: "verified",
        },
      ],
      corpusScore,
      styleTags: [
        "文雅书卷",
        /草|木|云|水|月|星|雨|花|自然|清朗/.test(interpretation)
          ? "清朗自然"
          : "沉稳端正",
      ],
      reviewStatus: "source_checked",
      checkedAt: "2026-09-30",
      sourceRefs: [
        {
          sourceId: ref.sourceId,
          location: `${ref.location} · ${title}`,
          excerpt: ref.quote,
          ...(ref.url ? { url: ref.url } : {}),
          ...(ref.revision ? { revision: String(ref.revision) } : {}),
        },
      ],
    };
  });
}
