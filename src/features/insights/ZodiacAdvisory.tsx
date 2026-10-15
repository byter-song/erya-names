import type { NamingProfile } from "../../domain/project/profile";
import { zodiacAdvisory } from "../../domain/folklore/zodiacAdvisory";
export function ZodiacAdvisory({
  givenName,
  folklore,
}: {
  givenName: string;
  folklore: NamingProfile["folklore"];
}) {
  const result = zodiacAdvisory(givenName, folklore);
  return (
    <section className="insight-note" aria-label="生肖选字提示">
      <h3>生肖选字提示</h3>
      <p>{result.status}</p>
      {result.hits.map((hit, i) => (
        <p key={i}>
          <strong>
            提醒：{hit.position === "start" ? "名字首字" : "名中"}“{hit.matched}”
          </strong>{" "}
          · {hit.explanation}
          <br />
          来源：{hit.source}（家庭录入，未经系统独立核验）
        </p>
      ))}
      <p>
        传统民俗参考，非科学结论。只提醒，不过滤、不扣分、不影响排序与定稿。字形部件仅按你明确列出的字表匹配，不推测未收录字的偏旁。
      </p>
    </section>
  );
}
