import { validateBirthDateTime } from "./birthDate";
export { validateBirthDateTime } from "./birthDate";
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

export function calculateBasicFiveElements(input: CalendarInput) {
  if (input.timeZone !== "Asia/Shanghai")
    throw new Error("当前支持中国标准时间 Asia/Shanghai（UTC+8），不做真太阳时修正");
  const timeKnown = input.timeKnown !== false;
  const error = validateBirthDateTime(input.localDateTime, timeKnown);
  if (error) throw new Error(error);
  const [date, time] = input.localDateTime.split("T");
  const [year, month, day] = date!.split("-").map(Number);
  // Noon is used only to resolve the calendar date when time is unknown; the hour pillar is omitted.
  const [hour, minute] = (timeKnown ? time! : "12:00").split(":").map(Number);
  const lunar = Solar.fromYmdHms(year!, month!, day!, hour!, minute!, 0).getLunar();
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
  return {
    pillars: columns.map((column) => column.pillar),
    columns,
    distribution,
    timeKnown,
    lunarDate: `${lunar.getYearInChinese()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
    dayMaster: eight.getDayGan(),
    dayMasterElement: eight.getDayWuXing()[0]!,
    lunarZodiac: lunar.getYearShengXiao(),
    pillarZodiac: lunar.getYearShengXiaoExact(),
    previousJie: { name: prev.getName(), time: prev.getSolar().toYmdHms() },
    nextJie: { name: next.getName(), time: next.getSolar().toYmdHms() },
    convention: input.dayBoundary === "zi" ? "晚子时（23:00）换日" : "民用午夜（00:00）换日",
    library: "lunar-typescript@1.8.6",
    disclaimer: "传统民俗参考，非科学结论。",
    caveats: [
      "年柱按立春交节、月柱按节令交接；农历生肖按正月初一换年，两种口径可能不同。",
      "五行只计天干与地支本气，每字等权；藏干另列，不计入柱状图。数量不代表旺衰，缺项不等于喜用神。",
      "使用中国标准时间，不做真太阳时或历史夏令时修正。节气与时辰交界附近应核对出生记录和采用流派。",
      ...(!timeKnown
        ? ["时辰不详：仅展示三柱，节气交接当天的年、月柱存在时间不确定性，不能据此断定喜用。"]
        : []),
    ],
  };
}
