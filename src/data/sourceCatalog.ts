export const sourceCatalog: Record<string, { title: string; url: string; note: string }> = {
  "standard-hanzi-2013": {
    title: "通用规范汉字表（2013）",
    url: "https://www.gov.cn/zwgk/2013-08/19/content_2469793.htm",
    note: "只证明规范用字；具体登记由当地户籍机关确认。",
  },
  "pinyin-data": {
    title: "pinyin-data · 固定版本",
    url: "https://github.com/mozillazg/pinyin-data/tree/923b108dc5d45dee061324c011b478fb649f8b73",
    note: "MIT；多音字与姓氏读音仍需结合实际确认。",
  },
  "erya-original-20260927": {
    title: "尔雅独立整理 · 2026-09-27",
    url: "",
    note: "取名释义与风格由 AI 整理，原文和规范字经过机器核对，未经专家逐条人审。",
  },
  "erya-modern-20260927": {
    title: "尔雅现代组合选集",
    url: "",
    note: "AI 按字义、名字搭配与日常使用独立编辑；不宣称古籍出处或专家人审。",
  },
  "erya-character-elements-20260930": {
    title: "尔雅字义五行意象整理 · 2026-09-30",
    url: "",
    note: "传统民俗参考，按字义意象优先、字形辅助的项目口径整理，不代表唯一权威属性。",
  },
  "unihan-17": {
    title: "Unicode 17 · Unihan",
    url: "https://www.unicode.org/reports/tr38/",
    note: "kTotalStrokes 的简体优先值，用于书写成本；不是康熙笔画。",
  },
  "hko-calendar": {
    title: "香港天文台 · 历法与节气",
    url: "https://www.hko.gov.hk/sc/gts/astronomy/Solar_Term.htm",
    note: "香港标准时间 UTC+8；历法事实与民俗解释分开。",
  },
  "hko-year": {
    title: "香港天文台 · 农历年的干支交替",
    url: "https://www.hko.gov.hk/sc/education/astronomy-and-time/time-service/00506-what-year-is-it-today.html",
    note: "民用农历年在正月初一换年，四柱年柱常以立春交节为界。",
  },
  "lunar-typescript": {
    title: "lunar-typescript 1.8.6",
    url: "https://github.com/6tail/lunar-typescript",
    note: "MIT；四柱、藏干与纳音计算实现。",
  },
  "civil-code": {
    title: "民法典 · 姓氏选择",
    url: "http://www.npc.gov.cn/c2/c30834/202012/t20201207_309091.html",
    note: "父母组合姓不能仅凭通过规范字检测就视为可登记。",
  },
};
const paths: Record<string, string> = {
  shijing: "诗经/shijing.json",
  chuci: "楚辞/chuci.json",
  lunyu: "论语/lunyu.json",
  daxue: "四书五经/daxue.json",
  mengzi: "四书五经/mengzi.json",
  zhongyong: "四书五经/zhongyong.json",
  "song-300": "宋词/宋词三百首.json",
  "tang-0": "全唐诗/poet.tang.0.json",
};
for (const [id, path] of Object.entries(paths))
  sourceCatalog[`chinese-poetry:${id}`] = {
    title: `古籍原文 · ${path.split("/")[0]}`,
    url: `https://github.com/chinese-poetry/chinese-poetry/blob/b8594f81a89752241442f2ce267d6f66f96704ee/${path}`,
    note: "公版古籍，数字化数据 MIT；保留原句和简体转写，释义为项目独立整理。",
  };
