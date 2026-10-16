import type { NamingProfile } from "../project/profile";
import { calculateBasicFiveElements } from "./calendarAdapter";
export const zodiacAnimals = [
  "鼠",
  "牛",
  "虎",
  "兔",
  "龙",
  "蛇",
  "马",
  "羊",
  "猴",
  "鸡",
  "狗",
  "猪",
] as const;

export interface ZodiacRule {
  id: string;
  zodiac: (typeof zodiacAnimals)[number];
  position: "start" | "any";
  characters: string[];
  direction: "prefer" | "avoid";
  deduction: number;
  explanation: string;
  sourceId: string;
}

export interface ZodiacHintResult {
  hits: Array<ZodiacRule & { matchedCharacters: string[] }>;
  deduction: number;
  hardStatus: "pass" | "notice";
}

/**
 * Evaluates the selected advisory school without turning a folklore match into
 * a generation filter or progression gate. Positive rules remain descriptive;
 * negative rules deduct at most twenty points from this module.
 */
export function evaluateZodiacHints(input: {
  givenName: string;
  zodiac: string;
  rules: readonly ZodiacRule[];
}): ZodiacHintResult {
  const hits = input.rules
    .filter((rule) => rule.zodiac === input.zodiac)
    .flatMap((rule) => {
      const haystack =
        rule.position === "start" ? [input.givenName[0] ?? ""] : [...input.givenName];
      const matchedCharacters = [
        ...new Set(haystack.filter((char) => rule.characters.includes(char))),
      ];
      return matchedCharacters.length ? [{ ...rule, matchedCharacters }] : [];
    });
  const deduction = Math.min(
    20,
    hits.reduce(
      (total, hit) => total + (hit.direction === "avoid" ? Math.max(0, hit.deduction) : 0),
      0,
    ),
  );
  return {
    hits,
    deduction,
    hardStatus: hits.length ? "notice" : "pass",
  };
}

export interface ZodiacAdvisoryInput {
  module: NamingProfile["modules"]["zodiac"];
  calendar: NamingProfile["calendar"];
  rules: readonly ZodiacRule[];
}

/** Presentation-only: never used by generation, rule scoring or progression guards. */
export function zodiacAdvisory(givenName: string, input: ZodiacAdvisoryInput) {
  if (!input.module.analysisEnabled) return { status: "未启用生肖分析", hits: [] };
  if (!input.calendar.birthLocalDateTime)
    return { status: "出生日期未填写，生肖待定", hits: [] };
  try {
    const calendar = calculateBasicFiveElements({
      localDateTime: input.calendar.birthLocalDateTime,
      timeZone: input.calendar.timeZone,
      dayBoundary: input.calendar.dayBoundary,
      timeKnown: input.calendar.timeKnown,
    });
    const zodiac =
      input.calendar.zodiacConvention === "pillar"
        ? calendar.pillarZodiac
        : calendar.lunarZodiac;
    const rules = input.rules.filter((rule) => rule.zodiac === zodiac);
    const result = evaluateZodiacHints({ givenName, zodiac, rules });
    const hits = result.hits.map((hit) => ({
      ...hit,
      matched: hit.matchedCharacters.join("、"),
    }));
    return {
      status: `${input.calendar.zodiacConvention === "pillar" ? "立春年支" : "农历正月初一"}口径：属${zodiac}。${rules.length ? (hits.length ? "命中生肖提示" : "未命中已复核的提示；不代表符合所有民俗流派") : "尚未录入适用提醒，资料不足"}。`,
      hits,
    };
  } catch {
    return { status: "出生信息尚不能确定生肖，请核对日期与时间", hits: [] };
  }
}
