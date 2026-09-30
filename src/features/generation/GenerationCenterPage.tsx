import { useState, type ReactNode } from "react";
import { Button } from "../../design-system/primitives/Button";
import { Card } from "../../design-system/primitives/Card";
import { activeRuntimeBundle } from "../../data/activeRuntimeBundle";
import { FolklorePanel } from "../insights/FolklorePanel";
import type { NamingProfile } from "../../domain/project/profile";
import "./generation-center.css";
export function GenerationCenterPage({
  profile,
  datasetVersion,
  generate,
  children,
  conditions,
}: {
  profile: Pick<NamingProfile, "surname" | "givenNameLength" | "styleTags"> & {
    folklore?: NamingProfile["folklore"];
  };
  datasetVersion: string;
  generate: (input: {
    requestedCount: number;
    allusionRatio: number;
  }) => Promise<{ candidateCount: number }>;
  onOpenCandidates?: () => void;
  children?: ReactNode;
  conditions?: ReactNode;
}) {
  const [count, setCount] = useState(48);
  const [ratio, setRatio] = useState(0.5);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<number>();
  const [error, setError] = useState("");
  const start = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const generated = await generate({ requestedCount: count, allusionRatio: ratio });
      setResult(generated.candidateCount);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "生成失败，请重试");
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="generation-center">
      <header className="studio-hero">
        <div>
          <p className="project-center__kicker">ERYA · 拾字成名</p>
          <h1>生名与初选</h1>
          <p>从万千字意中，遇见心里的那个名字。</p>
          <p className="studio-hero__sub">批量寻名，同页细选。先留下喜欢，再从容比较。</p>
        </div>
        <span className="studio-seal" aria-hidden="true">
          拾字
          <br />
          成名
        </span>
      </header>
      {activeRuntimeBundle.characters.length === 0 ? (
        <p role="status" className="insight-note">
          起名资料未载入，暂时停止生成。已有名字仍可阅读、备份；恢复本地服务后重新载入即可继续。
        </p>
      ) : null}
      <Card className="generation-plan">
        <div className="studio-section-heading">
          <div>
            <h2>为{profile.surname}姓宝宝，寻一批好名字</h2>
            <p>
              {profile.givenNameLength === 2 ? "二字名" : "一字名"} ·{" "}
              {profile.styleTags.join(" / ") || "风格不限"} · 自动避开已生成的名字
            </p>
          </div>
          <span className="ui-status">仅在本机计算</span>
        </div>
        <div className="generation-controls">
          <label>
            每批数量
            <select
              aria-label="每批生成数量"
              value={count}
              disabled={busy}
              onChange={(e) => setCount(Number(e.target.value))}
            >
              {[24, 48, 96].map((n) => (
                <option key={n} value={n}>
                  {n} 个名字
                </option>
              ))}
            </select>
          </label>
          <label>
            取名方向
            <select
              aria-label="典故比例"
              value={ratio}
              disabled={busy}
              onChange={(e) => setRatio(Number(e.target.value))}
            >
              <option value={0.5}>典故与字义兼顾</option>
              <option value={1}>典故优先</option>
              <option value={0}>字义组合优先</option>
            </select>
          </label>
          <Button
            type="button"
            disabled={busy || activeRuntimeBundle.characters.length === 0}
            onClick={() => void start()}
          >
            {busy ? "正在寻名…" : `生成 ${count} 个名字`}
          </Button>
        </div>
        <p className="muted">
          先按规范字与家庭条件过滤，再按风格、书写和所选民俗偏好排序。典故不足时用字义组合补充。
        </p>
        {result !== undefined ? (
          <div className="generation-feedback" role="status">
            <strong>
              {result > 0 ? `本批已生成 ${result} 个名字` : "这组条件暂时没有新的名字"}
            </strong>
            <p>
              {result < count
                ? "符合条件且未生成过的结果不足目标数。请尝试减少指定字、调整字数或避字；历史灵感仍保留在下方。"
                : "名字已保存到下方灵感池。查看解释，把喜欢的收入候选即可。"}
            </p>
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="onboarding__error">
            {error}
          </p>
        ) : null}
      </Card>
      {conditions}
      {profile.folklore?.enabled ? (
        <details className="studio-folklore-summary paper-card">
          <summary>本方案的出生时序与民俗参考</summary>
          <FolklorePanel profile={{ folklore: profile.folklore }} />
        </details>
      ) : null}
      {children}
      <details className="studio-library paper-card">
        <summary>选名小册 · 资料与使用方法</summary>
        <div className="guide-grid">
          <section>
            <h3>先好用，再动心</h3>
            <p>
              先确认姓氏登记、规范字、家庭避讳与全名读音，再看字义、典故和书写。选择喜欢的名字后，连读、手写并请家人用方言叫一叫。
            </p>
          </section>
          <section>
            <h3>字辈与家庭习惯</h3>
            <p>
              在起名条件里用“知:1”固定名的首字，用“知:2”固定末字。把家中不宜用的字列入避字，把亲属全名与不喜欢的组合单独列出。
            </p>
          </section>
          <section>
            <h3>诗经楚辞，都可以读</h3>
            <p>
              “女诗经、男楚辞”是一种流传的取名偏好，不是性别限制。优先理解原句语境，再决定取连续词语还是同句取字。
            </p>
          </section>
          <section>
            <h3>民俗尊重家人意愿</h3>
            <p>
              生肖、五行和五格采用的分类不同。名字中的木水意象、四柱计数、笔画数理不能相互替代；不从缺项直接推导“补什么”。
            </p>
          </section>
        </div>
        <p>
          内容包 {datasetVersion} · {activeRuntimeBundle.characters.length} 个用字 ·{" "}
          {activeRuntimeBundle.allusions.length} 条典故
          {activeRuntimeBundle.modernCombinations?.length
            ? ` · ${activeRuntimeBundle.modernCombinations.length} 个现代组合`
            : ""}
          。个人包采用来源核对与 AI
          独立整理，尚未经过专家逐条人工审校。每个名字的详情可查看原句与来源链接。
        </p>
      </details>
    </main>
  );
}
