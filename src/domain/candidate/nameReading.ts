const surnameReadings: Record<string, string> = {
  宋: "sòng",
  王: "wáng",
  李: "lǐ",
  张: "zhāng",
  刘: "liú",
  陈: "chén",
  杨: "yáng",
  黄: "huáng",
  赵: "zhào",
  吴: "wú",
  周: "zhōu",
  徐: "xú",
  孙: "sūn",
  马: "mǎ",
  朱: "zhū",
  胡: "hú",
  郭: "guō",
  何: "hé",
  林: "lín",
  高: "gāo",
  罗: "luó",
  郑: "zhèng",
  梁: "liáng",
  谢: "xiè",
  唐: "táng",
  许: "xǔ",
  韩: "hán",
  冯: "féng",
  邓: "dèng",
  曹: "cáo",
  彭: "péng",
  曾: "zēng",
  肖: "xiāo",
  田: "tián",
  董: "dǒng",
  潘: "pān",
  袁: "yuán",
  于: "yú",
  蒋: "jiǎng",
  蔡: "cài",
  余: "yú",
  杜: "dù",
  叶: "yè",
  程: "chéng",
  魏: "wèi",
  苏: "sū",
  吕: "lǚ",
  丁: "dīng",
  任: "rén",
  沈: "shěn",
  姚: "yáo",
  卢: "lú",
  姜: "jiāng",
  崔: "cuī",
  钟: "zhōng",
  谭: "tán",
  陆: "lù",
  汪: "wāng",
  范: "fàn",
  金: "jīn",
  石: "shí",
  廖: "liào",
  贾: "jiǎ",
  夏: "xià",
  韦: "wéi",
  付: "fù",
  方: "fāng",
  白: "bái",
  邹: "zōu",
  孟: "mèng",
  熊: "xióng",
  秦: "qín",
  邱: "qiū",
  江: "jiāng",
  尹: "yǐn",
  薛: "xuē",
  闫: "yán",
  段: "duàn",
  雷: "léi",
  侯: "hóu",
  龙: "lóng",
  史: "shǐ",
  陶: "táo",
  黎: "lí",
  贺: "hè",
  顾: "gù",
  毛: "máo",
  郝: "hǎo",
  龚: "gōng",
  邵: "shào",
  万: "wàn",
  钱: "qián",
  严: "yán",
  赖: "lài",
  武: "wǔ",
  戴: "dài",
  莫: "mò",
  孔: "kǒng",
  向: "xiàng",
  汤: "tāng",
  单: "shàn",
  解: "xiè",
  查: "zhā",
  区: "ōu",
  仇: "qiú",
  朴: "piáo",
  乐: "yuè",
  欧阳: "ōu yáng",
  司马: "sī mǎ",
  上官: "shàng guān",
  诸葛: "zhū gě",
  夏侯: "xià hóu",
  司徒: "sī tú",
  尉迟: "yù chí",
  慕容: "mù róng",
  南宫: "nán gōng",
  东方: "dōng fāng",
  皇甫: "huáng fǔ",
  令狐: "líng hú",
  长孙: "zhǎng sūn",
  宇文: "yǔ wén",
  公孙: "gōng sūn",
  端木: "duān mù",
};
export function readSurname(surname: string, override?: string): string[] {
  if (override?.trim()) return override.trim().split(/\s+/u);
  if (surnameReadings[surname]) return surnameReadings[surname].split(" ");
  return [...surname].flatMap((char) => surnameReadings[char]?.split(" ") ?? [char]);
}
export function toneOf(syllable: string): number | undefined {
  if (/[āēīōūǖ]/u.test(syllable)) return 1;
  if (/[áéíóúǘ]/u.test(syllable)) return 2;
  if (/[ǎěǐǒǔǚ]/u.test(syllable)) return 3;
  if (/[àèìòùǜ]/u.test(syllable)) return 4;
  return /^[a-zü]+$/iu.test(syllable) ? 0 : undefined;
}
export function normalizePinyin(syllables: string[]): string {
  return syllables
    .join("")
    .normalize("NFD")
    .replace(/[\u0300\u0301\u0304\u030c]/gu, "")
    .normalize("NFC")
    .toLowerCase();
}
export function nameSoundNotes(syllables: string[]): string[] {
  const tones = syllables.map(toneOf);
  const notes = [
    tones.some((t) => t === undefined)
      ? "姓氏或名字有尚待确认的读音，请先人工确认。"
      : `普通话本调：${tones.map((t) => (t === 0 ? "轻声" : `${t}声`)).join(" → ")}。连读时可能发生变调。`,
  ];
  if (tones.some((tone, i) => tone === 3 && tones[i + 1] === 3))
    notes.push("连续上声在普通话连读时会变调，请按全名试读。");
  const flat = syllables.map((x) => normalizePinyin([x]));
  if (new Set(flat).size < flat.length)
    notes.push("存在同音音节；有叠韵感，也可能增加呼叫辨识成本。");
  notes.push(
    "请以普通话和家中方言各连读三遍，并分别试读自我介绍、点名和昵称；这里不推断方言谐音。",
  );
  return notes;
}
