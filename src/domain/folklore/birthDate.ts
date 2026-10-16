export interface ParsedBirthDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  timeKnown: boolean;
  precision: "date" | "minute";
}

const BIRTH_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/u;

/**
 * Parse a civil local date without relying on the host machine's time zone.
 * Noon is a deterministic placeholder for date-only calculations and must not
 * be exposed as a known birth hour.
 */
export function parseBirthDateTime(
  value: string,
  timeKnown = true,
): { value?: ParsedBirthDateTime; error?: string } {
  const match = value.match(BIRTH_DATE_TIME_PATTERN);
  const missingRequiredTime = timeKnown && match?.[4] === undefined;
  if (!match || missingRequiredTime)
    return {
      error: timeKnown ? "请填写有效的公历出生日期和时间" : "请填写有效的公历出生日期",
    };

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const suppliedHour = match[4] === undefined ? undefined : Number(match[4]);
  const suppliedMinute = match[5] === undefined ? undefined : Number(match[5]);
  const hour = timeKnown ? suppliedHour! : 12;
  const minute = timeKnown ? suppliedMinute! : 0;
  const validationHour = suppliedHour ?? 12;
  const validationMinute = suppliedMinute ?? 0;
  const date = new Date(Date.UTC(year, month - 1, day, validationHour, validationMinute));

  if (
    year < 1900 ||
    year > 2100 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    validationHour > 23 ||
    validationMinute > 59
  )
    return { error: "出生日期需为 1900–2100 年内的有效公历日期" };

  return {
    value: {
      year,
      month,
      day,
      hour,
      minute,
      timeKnown,
      precision: timeKnown ? "minute" : "date",
    },
  };
}

export function validateBirthDateTime(value: string, timeKnown = true): string | undefined {
  return parseBirthDateTime(value, timeKnown).error;
}
