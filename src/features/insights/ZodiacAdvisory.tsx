import type { NamingProfile } from "../../domain/project/profile";
import { calculateBasicFiveElements } from "../../domain/folklore/calendarAdapter";
import type { RuleEvidence } from "../../domain/rules/result";

export function ZodiacAdvisory({
  givenName,
  profile,
  evidence = [],
}: {
  givenName: string;
  profile: Pick<NamingProfile, "calendar" | "modules">;
  evidence?: readonly RuleEvidence[];
}) {
  const module = profile.modules.zodiac;
  if (!module.detailsVisible) return null;
  if (!profile.calendar.birthLocalDateTime)
    return (
      <section className="insight-note" aria-label="生肖选字提示">
        <h3>生肖选字提示</h3>
        <p>出生日期未填写，生肖待定。</p>
      </section>
    );

  let status = "出生信息尚不能确定生肖，请核对日期与时间。";
  try {
    const calendar = calculateBasicFiveElements({
      localDateTime: profile.calendar.birthLocalDateTime,
      timeZone: profile.calendar.timeZone,
      dayBoundary: profile.calendar.dayBoundary,
      timeKnown: profile.calendar.timeKnown,
    });
    const zodiac =
      profile.calendar.zodiacConvention === "pillar"
        ? calendar.pillarZodiac
        : calendar.lunarZodiac;
    status = `${profile.calendar.zodiacConvention === "pillar" ? "立春年支" : "农历正月初一"}口径：属${zodiac}。名字“${givenName}”将按当前规则包显示字形提示。`;
  } catch {
    // Keep the actionable fallback above.
  }

  return (
    <section className="insight-note" aria-label="生肖选字提示">
      <h3>生肖选字提示</h3>
      <p>{status}</p>
      <p>
        按所选生肖流派提供选字提示，不直接过滤名字；规则口径为 {module.schoolId} ·{" "}
        {module.ruleVersion}。
      </p>
      {evidence.length ? (
        <ul>
          {evidence.map((item) => (
            <li key={item.id}>
              <strong>
                {item.status === "pass"
                  ? "符合"
                  : item.status === "notice"
                    ? "提示"
                    : item.status === "conflict"
                      ? "需留意"
                      : "待补资料"}
              </strong>
              ：{item.explanation}
            </li>
          ))}
        </ul>
      ) : (
        <p>当前名字没有可展示的生肖字形命中；完整证据会随分析结果保留。</p>
      )}
    </section>
  );
}
