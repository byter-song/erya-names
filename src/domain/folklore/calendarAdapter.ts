import { parseBirthDateTime } from "./birthDate";
export { parseBirthDateTime, validateBirthDateTime } from "./birthDate";
import { Solar } from "lunar-typescript";
import type { FiveElement } from "./fiveElements";
export { elementLabels } from "./fiveElements";
export type { FiveElement } from "./fiveElements";
const elementMap: Record<string, FiveElement> = {
  木: "wood",
  火: "fire",
  土: "earth",
  金: "metal",
  水: "water",
};

export interface CalendarInput {
  localDateTime: string;
  timeZone: string;
  dayBoundary?: "midnight" | "zi";
  timeKnown?: boolean;
}

export interface CalendarBoundary {
  name: string;
  /** Civil time in the configured time zone, with second precision. */
  time: string;
  timeZone: "Asia/Shanghai";
}

export interface CalendarUncertainty {
  level: "bounded" | "missing_time";
  reasons: string[];
}

export function calculateBasicFiveElements(input: CalendarInput) {
  if (input.timeZone !== "Asia/Shanghai")
    throw new Error("当前支持中国标准时间 Asia/Shanghai（UTC+8），不做真太阳时修正");
  const timeKnown = input.timeKnown !== false;
  const parsed = parseBirthDateTime(input.localDateTime, timeKnown);
  if (!parsed.value) throw new Error(parsed.error);
  const { year, month, day, hour, minute } = parsed.value;
  const lunar = Solar.fromYmdHms(year, month, day, hour, minute, 0).getLunar();
  const eight = lunar.getEightChar();
  eight.setSect(input.dayBoundary === "zi" ? 1 : 2);
  const columns = [
    {
      label: "年柱",
      pillar: eight.getYear(),
      elements: eight.getYearWuXing(),
      hiddenStems: eight.getYearHideGan(),
      naYin: eight.getYearNaYin(),
    },
    {
      label: "月柱",
      pillar: eight.getMonth(),
      elements: eight.getMonthWuXing(),
      hiddenStems: eight.getMonthHideGan(),
      naYin: eight.getMonthNaYin(),
    },
    {
      label: "日柱",
      pillar: eight.getDay(),
      elements: eight.getDayWuXing(),
      hiddenStems: eight.getDayHideGan(),
      naYin: eight.getDayNaYin(),
    },
    ...(timeKnown
      ? [
          {
            label: "时柱",
            pillar: eight.getTime(),
            elements: eight.getTimeWuXing(),
            hiddenStems: eight.getTimeHideGan(),
            naYin: eight.getTimeNaYin(),
          },
        ]
      : []),
  ];
  const distribution: Record<FiveElement, number> = {
    wood: 0,
    fire: 0,
    earth: 0,
    metal: 0,
    water: 0,
  };
  for (const column of columns)
    for (const symbol of column.elements) {
      const element = elementMap[symbol];
      if (element) distribution[element]++;
    }
  const prev = lunar.getPrevJie();
  const next = lunar.getNextJie();
  const dayMasterElement = elementMap[eight.getDayWuXing()[0] ?? ""];
  if (!dayMasterElement) throw new Error("无法识别日主五行");
  const caveats = [
    "年柱按立春交节、月柱按节令交接；农历生肖按正月初一换年，两种口径可能不同。",
    "五行只计天干与地支本气，每字等权；藏干另列，不计入柱状图。数量不代表旺衰，缺项不等于喜用神。",
    "使用中国标准时间，不做真太阳时或历史夏令时修正。节气与时辰交界附近应核对出生记录和采用流派。",
    ...(!timeKnown
      ? ["时辰不详：仅展示三柱，节气交接当天的年、月柱存在时间不确定性，不能据此断定喜用。"]
      : []),
  ];
  const boundary = (jie: typeof prev): CalendarBoundary => ({
    name: jie.getName(),
    time: jie.getSolar().toYmdHms(),
    timeZone: "Asia/Shanghai",
  });
  return {
    pillars: columns.map((column) => column.pillar),
    columns,
    distribution,
    timeKnown,
    lunarDate: `${lunar.getYearInChinese()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
    dayMaster: eight.getDayGan(),
    dayMasterElement,
    lunarZodiac: lunar.getYearShengXiao(),
    pillarZodiac: lunar.getYearShengXiaoExact(),
    previousJie: boundary(prev),
    nextJie: boundary(next),
    conventions: {
      calendar: "proleptic-gregorian",
      pillarYearBoundary: "start-of-spring",
      pillarMonthBoundary: "jie",
      timeZone: "Asia/Shanghai",
      dayBoundary: input.dayBoundary === "zi" ? "late-zi-23:00" : "civil-midnight-00:00",
      trueSolarTimeCorrection: "not_applied",
      historicalDstCorrection: "not_applied",
    } as const,
    uncertainty: {
      level: timeKnown ? "bounded" : "missing_time",
      reasons: timeKnown
        ? ["节气与时辰交界附近需核对出生记录。"]
        : ["时辰不详，未生成时柱。", "日期落在交节当天时，年柱或月柱可能随实际出生时间改变。"],
    } satisfies CalendarUncertainty,
    convention: input.dayBoundary === "zi" ? "晚子时（23:00）换日" : "民用午夜（00:00）换日",
    library: "lunar-typescript@1.8.6",
    disclaimer: "按所选传统历法口径计算；结果会随换日、交节与生肖口径变化。",
    caveats,
  };
}
