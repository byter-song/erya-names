export function validateBirthDateTime(value: string, timeKnown = true): string | undefined {
  const match = value.match(
    timeKnown
      ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/u
      : /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2})?$/u,
  );
  if (!match) return timeKnown ? "请填写有效的公历出生日期和时间" : "请填写有效的公历出生日期";
  const [, y, m, d, h = "12", min = "00"] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), Number(h), Number(min)));
  if (
    Number(y) < 1900 ||
    Number(y) > 2100 ||
    date.getUTCFullYear() !== Number(y) ||
    date.getUTCMonth() !== Number(m) - 1 ||
    date.getUTCDate() !== Number(d) ||
    Number(h) > 23 ||
    Number(min) > 59
  )
    return "出生日期需为 1900–2100 年内的有效公历日期";
  return undefined;
}
