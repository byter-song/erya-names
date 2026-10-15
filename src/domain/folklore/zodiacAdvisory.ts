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
export type ZodiacRule = NonNullable<NamingProfile["folklore"]["zodiacRules"]>[number];
/** Presentation-only: never used by generation, rule scoring or progression guards. */
export function zodiacAdvisory(givenName: string, folklore: NamingProfile["folklore"]) {
  if (!folklore.enabled) return { status: "未采用生肖参考", hits: [] };
  if (!folklore.birthLocalDateTime) return { status: "出生日期未填写，生肖待定", hits: [] };
  try {
    const calendar = calculateBasicFiveElements({
      localDateTime: folklore.birthLocalDateTime,
      timeZone: folklore.timeZone ?? "Asia/Shanghai",
      ...(folklore.dayBoundary ? { dayBoundary: folklore.dayBoundary } : {}),
      ...(folklore.timeKnown !== undefined ? { timeKnown: folklore.timeKnown } : {}),
    });
    const zodiac =
      folklore.zodiacConvention === "pillar" ? calendar.pillarZodiac : calendar.lunarZodiac;
    const rules = (folklore.zodiacRules ?? []).filter((rule) => rule.zodiac === zodiac);
    const hits = rules.flatMap((rule) => {
      const chars = [
        ...new Set(
          [...(rule.position === "start" ? (givenName[0] ?? "") : givenName)].filter((char) =>
            rule.characters.includes(char),
          ),
        ),
      ];
      return chars.length ? [{ ...rule, matched: chars.join("、") }] : [];
    });
    return {
      status: `${folklore.zodiacConvention === "pillar" ? "立春年支" : "农历正月初一"}口径：属${zodiac}。${rules.length ? (hits.length ? "命中家庭生肖提醒" : "未命中已录入的提醒；不代表符合所有民俗流派") : "尚未录入适用提醒，资料不足"}。`,
      hits,
    };
  } catch {
    return { status: "出生信息尚不能确定生肖，请核对日期与时间", hits: [] };
  }
}
