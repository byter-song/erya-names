import { readFile, writeFile } from "node:fs/promises";

const source = new URL(
  "../../docs/references/standards/%E9%80%9A%E7%94%A8%E8%A7%84%E8%8C%83%E6%B1%89%E5%AD%97%E8%A1%A8.md",
  import.meta.url,
);
const target = new URL("../../src/data/curated/standard-characters.json", import.meta.url);
const markdown = await readFile(source, "utf8");
const mainTable = markdown.split("## 附件1")[0];
const entries = [...mainTable.matchAll(/(?:^|[|\s])(\d{4})\s+(\p{Script=Han})/gu)]
  .map((match) => ({ index: Number(match[1]), char: match[2] }))
  .sort((left, right) => left.index - right.index);

if (entries.length !== 8105 || entries.some((entry, index) => entry.index !== index + 1)) {
  throw new Error(
    `Expected a continuous 8105-character official table, received ${entries.length}`,
  );
}

await writeFile(
  target,
  `${JSON.stringify({
    sourceId: "standard-hanzi-2013",
    generatedFrom: "docs/references/standards/通用规范汉字表.md",
    count: entries.length,
    characters: entries.map((entry) => entry.char).join(""),
  })}\n`,
  "utf8",
);
