import { useState } from "react";
import type { CandidateFunnelItem } from "../../application/models/CandidateFunnelItem";
import type { NamingProfile } from "../../domain/project/profile";
import { Dialog } from "../../design-system/primitives/Dialog";
import { NameExplanation } from "../insights/NameExplanation";
import "./comparison.css";

const poolLabels: Record<CandidateFunnelItem["pool"], string> = {
  inspiration: "灵感池",
  candidate: "候选池",
  selected: "精选池",
  excluded: "排除区",
};

const hardStatusLabels: Record<CandidateFunnelItem["hardStatus"], string> = {
  pass: "基础规范通过",
  notice: "基础规范有提示",
  conflict: "基础规范有冲突",
  unknown: "基础规范待补充",
};

function scoreLabel(candidate: CandidateFunnelItem) {
  if (candidate.scoringPending) return "分析中";
  return `${candidate.completeness < 1 ? "暂定 " : ""}${candidate.totalScore === undefined ? "—" : Number(candidate.totalScore.toFixed(1))}/100`;
}

const moduleLabels: Record<keyof NamingProfile["modules"], string> = {
  bazi_wuxing: "八字五行",
  zodiac: "生肖提示",
  traditional: "传统原则",
  name_hexagram: "姓名卦象",
  five_grids: "五格数理",
};

/**
 * Read-only comparison content for the candidate-pool drawer or dialog.
 * Pool transitions stay on candidate cards so reviewing details cannot change decisions.
 */
export function ComparisonPage({
  candidates,
  profile,
}: {
  candidates: CandidateFunnelItem[];
  profile?: NamingProfile;
}) {
  const [detailId, setDetailId] = useState<string>();
  const detail = candidates.find((candidate) => candidate.id === detailId);

  return (
    <section aria-labelledby="candidate-comparison-title" className="comparison-drawer">
      <header className="comparison-drawer__header">
        <div>
          <p className="project-center__kicker">尔雅 · 候选对照</p>
          <h2 id="candidate-comparison-title">并列比较</h2>
          <p>横向查看综合分、完整度和主要扣分。比较仅供查看，不会改变名字所在池。</p>
        </div>
        <p aria-label={`共 ${candidates.length} 个名字`} className="comparison-drawer__count">
          <strong>{candidates.length}</strong>
          <span>个名字</span>
        </p>
      </header>

      {candidates.length ? (
        <div
          aria-label="名字对照表，可横向滚动"
          className="comparison-drawer__scroller"
          role="region"
          tabIndex={0}
        >
          <table className="comparison-drawer__table">
            <thead>
              <tr>
                <th scope="col">对照项</th>
                {candidates.map((candidate) => (
                  <th key={candidate.id} scope="col">
                    <strong>{candidate.fullName}</strong>
                    <span>{candidate.pinyin.join(" · ")}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <ComparisonRow candidates={candidates} label="当前池">
                {(candidate) => poolLabels[candidate.pool]}
              </ComparisonRow>
              <ComparisonRow candidates={candidates} label="基础状态">
                {(candidate) => hardStatusLabels[candidate.hardStatus]}
              </ComparisonRow>
              <ComparisonRow candidates={candidates} label="综合分">
                {(candidate) => scoreLabel(candidate)}
              </ComparisonRow>
              <ComparisonRow candidates={candidates} label="完整度">
                {(candidate) => `${Math.round(candidate.completeness * 100)}%`}
              </ComparisonRow>
              {profile
                ? (Object.keys(profile.modules) as Array<keyof NamingProfile["modules"]>)
                    .filter((moduleId) => profile.modules[moduleId].analysisEnabled)
                    .map((moduleId) => (
                      <ComparisonRow
                        candidates={candidates}
                        key={moduleId}
                        label={moduleLabels[moduleId]}
                      >
                        {(candidate) =>
                          candidate.moduleScores[moduleId] === undefined
                            ? "待补资料"
                            : `${candidate.moduleScores[moduleId]}/100`
                        }
                      </ComparisonRow>
                    ))
                : null}
              <ComparisonRow candidates={candidates} label="名字寓意">
                {(candidate) => candidate.summary}
              </ComparisonRow>
              <ComparisonRow candidates={candidates} label="主要扣分">
                {(candidate) => candidate.topDeductions[0]?.explanation ?? "暂无主要扣分"}
              </ComparisonRow>
              <ComparisonRow candidates={candidates} label="个人评分">
                {(candidate) => (candidate.rating ? `${candidate.rating}/5` : "未评分")}
              </ComparisonRow>
              <ComparisonRow candidates={candidates} label="个人备注">
                {(candidate) => candidate.note ?? "未填写"}
              </ComparisonRow>
              <tr>
                <th scope="row">详细依据</th>
                {candidates.map((candidate) => (
                  <td key={candidate.id}>
                    <button onClick={() => setDetailId(candidate.id)} type="button">
                      查看{candidate.fullName}详情
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="comparison-drawer__empty" role="status">
          <strong>还没有加入对照的名字</strong>
          <p>从候选池选择想比较的名字后，会在这里并列显示；对照数量不设上限。</p>
        </div>
      )}

      {detail ? (
        <Dialog onClose={() => setDetailId(undefined)} title={`${detail.fullName}详情`}>
          <NameExplanation candidate={detail} {...(profile ? { profile } : {})} showFolklore />
        </Dialog>
      ) : null}
    </section>
  );
}

function ComparisonRow({
  candidates,
  label,
  children,
}: {
  candidates: CandidateFunnelItem[];
  label: string;
  children: (candidate: CandidateFunnelItem) => string;
}) {
  return (
    <tr>
      <th scope="row">{label}</th>
      {candidates.map((candidate) => (
        <td key={candidate.id}>{children(candidate)}</td>
      ))}
    </tr>
  );
}
