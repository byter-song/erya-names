import type { PersonUsage } from "../../../src/data/schema/runtimeBundle";

export const HISTORICAL_PERSON_QID_WHITELIST = [
  "Q7071",
  "Q33772",
  "Q36020",
  "Q319618",
  "Q464470",
] as const;

export interface HistoricalPersonRow {
  qid: string;
  name: string;
  period: string;
  description: string;
}

export interface ImperialExamPersonRow {
  id: string;
  name: string;
  period: string;
  identityType: "zhuangyuan" | "bangyan" | "tanhua" | "jinshi";
  description: string;
  rankEvidence: string;
  sourceRefs: PersonUsage["sourceRefs"];
}

const qidWhitelist = new Set<string>(HISTORICAL_PERSON_QID_WHITELIST);

export function normalizePersonRows(
  rows: HistoricalPersonRow[],
  checkedAt: string,
): PersonUsage[] {
  return rows
    .map((row): PersonUsage => {
      if (!qidWhitelist.has(row.qid)) {
        throw new Error(`Person QID is not allowlisted: ${row.qid}`);
      }
      return {
        id: `person:${row.qid}`,
        name: row.name.normalize("NFC"),
        period: row.period,
        identityType: "historical_person",
        description: row.description,
        sourceRefs: [
          {
            sourceId: "wikidata-person-usage",
            location: `Wikidata ${row.qid}`,
            url: `https://www.wikidata.org/wiki/${row.qid}`,
          },
        ],
        reviewStatus: "source_checked",
        checkedAt,
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function normalizeImperialExamRows(
  rows: ImperialExamPersonRow[],
  checkedAt: string,
): PersonUsage[] {
  return rows
    .map((row): PersonUsage => ({
      ...row,
      id: `person:${row.id}`,
      name: row.name.normalize("NFC"),
      reviewStatus: "source_checked",
      checkedAt,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}
