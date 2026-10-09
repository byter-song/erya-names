import { Button } from "../../design-system/primitives/Button";
import { Card } from "../../design-system/primitives/Card";
import type { CandidateFunnelItem } from "../../application/models/CandidateFunnelItem";
import { cardLevelWarnings } from "./warningVisibility";

const sourceLabels = {
  verified_allusion: "古籍取名",
  modern_combination: "字义组合",
  user_input: "手工录入",
};

const stageLabels = {
  basic_shortlist: "基础候选",
  favorite: "基础候选",
  folklore_review: "民俗候选",
  comparison: "已入重点",
  finalist: "已入定稿",
} as const;

export function CandidateCard({
  item,
  busy,
  rating,
  note,
  rejectionReason,
  onRatingChange,
  onNoteChange,
  onNoteCommit,
  onRejectionReasonChange,
  onOpenDetail,
  onMove,
  showFolklore = false,
  progressionBlocked = false,
  onResolveConstraints,
}: {
  item: CandidateFunnelItem;
  busy: boolean;
  rating?: number;
  note: string;
  rejectionReason: string;
  onRatingChange: (rating: number) => void;
  onNoteChange: (note: string) => void;
  onNoteCommit: (note: string) => void;
  onRejectionReasonChange: (reason: string) => void;
  onOpenDetail: () => void;
  onMove: (
    stage: "inbox" | "basic_shortlist" | "folklore_review" | "comparison" | "excluded",
  ) => void;
  showFolklore?: boolean;
  progressionBlocked?: boolean;
  onResolveConstraints?: () => void;
}) {
  const chosen = [
    "basic_shortlist",
    "folklore_review",
    "favorite",
    "comparison",
    "finalist",
  ].includes(item.stage);
  const excluded = item.stage === "excluded" || item.stage === "rejected";
  const basic = item.stage === "basic_shortlist" || item.stage === "favorite";
  const visibleWarnings = cardLevelWarnings(item);
  const folkloreEvidence = item.ruleEvidence?.filter((rule) => rule.evidenceLevel === "L4");
  const folkloreInsufficient =
    !folkloreEvidence?.length ||
    folkloreEvidence.some((rule) => /没有已复核|保持 0 分|资料不足/.test(rule.explanation));
  return (
    <Card className="candidate-card" data-candidate-id={item.id} data-stage={item.stage}>
      <div className="candidate-card__header">
        <div>
          <h2>{item.fullName}</h2>
          <p>{item.pinyin.join(" · ")}</p>
        </div>
        <div className="candidate-card__statuses">
          <span className="ui-status">{sourceLabels[item.sourceType]}</span>
          {item.stage in stageLabels ? (
            <span className="ui-status candidate-card__stage">
              {stageLabels[item.stage as keyof typeof stageLabels]}
            </span>
          ) : null}
        </div>
      </div>
      <p className="candidate-card__meaning">{item.summary}</p>
      <div className="candidate-tags">
        {item.styleTags?.slice(0, 2).map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
        <span>系统匹配 {item.systemScore ?? 0}/100</span>
      </div>
      {visibleWarnings.length ? (
        <p className="candidate-card__warning">{visibleWarnings[0]!.explanation}</p>
      ) : (
        <p className="candidate-card__safe">当前规则未发现明显风险 · 仍请全名试读</p>
      )}
      {showFolklore && (item.stage === "folklore_review" || item.folkloreReviewed) ? (
        <section className="candidate-card__folklore" aria-label="民俗筛选结果">
          <strong>
            {folkloreInsufficient ? "传统参考暂不可判断" : "与当前家庭民俗偏好方向一致"}
          </strong>
          <span>{folkloreInsufficient ? "资料不足" : "资料部分完整"}</span>
          <p>
            {folkloreEvidence?.map((rule) => rule.explanation).join("；") ||
              "本方案未启用可计分的民俗偏好，仅保留说明。"}
          </p>
          <small>传统民俗参考，非科学结论。</small>
        </section>
      ) : null}
      {chosen ? (
        <div className="candidate-card__evaluation">
          <label>
            个人评分
            <select
              aria-label={`评分${item.fullName}`}
              disabled={busy}
              onChange={(event) => onRatingChange(Number(event.target.value))}
              value={rating ?? item.rating ?? ""}
            >
              <option disabled value="">
                未评分
              </option>
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  {value} 分
                </option>
              ))}
            </select>
          </label>
          <label>
            心选理由
            <input
              aria-label={`备注${item.fullName}`}
              onBlur={(event) => onNoteCommit(event.currentTarget.value)}
              onChange={(event) => onNoteChange(event.target.value)}
              placeholder="喜欢哪里，家人怎么说…"
              value={note}
            />
          </label>
        </div>
      ) : null}
      {excluded ? (
        <p>暂不考虑：{(item.rejectionReason ?? rejectionReason) || "已移出灵感池"}</p>
      ) : null}
      <div className="candidate-card__actions">
        <button
          aria-label={`查看${item.fullName}详情`}
          onClick={(event) => {
            event.currentTarget.focus();
            onOpenDetail();
          }}
          type="button"
        >
          查看名字详情
        </button>
        {item.stage === "inbox" ? (
          <Button
            aria-label={`保留到基础候选${item.fullName}`}
            disabled={busy}
            onClick={() => onMove("basic_shortlist")}
            type="button"
          >
            保留到基础候选
          </Button>
        ) : excluded ? (
          <button
            disabled={busy}
            onClick={() =>
              onMove(
                item.lastActiveStage === "finalist"
                  ? "comparison"
                  : (item.lastActiveStage ?? "inbox"),
              )
            }
            type="button"
          >
            恢复到候选池
          </button>
        ) : basic ? (
          <>
            <Button disabled={busy} onClick={() => onMove("folklore_review")} type="button">
              下一步：进入民俗候选
            </Button>
            <button
              disabled={busy || progressionBlocked}
              onClick={() => onMove("comparison")}
              type="button"
            >
              跳过民俗，加入重点候选
            </button>
            {progressionBlocked ? (
              <button disabled={busy} onClick={onResolveConstraints} type="button">
                进入重点前先核对家庭规则
              </button>
            ) : null}
            <button disabled={busy} onClick={() => onMove("inbox")} type="button">
              移除到灵感池
            </button>
          </>
        ) : item.stage === "folklore_review" ? (
          <>
            <Button
              disabled={busy || progressionBlocked}
              onClick={() => onMove("comparison")}
              type="button"
            >
              加入重点候选
            </Button>
            {progressionBlocked ? (
              <button disabled={busy} onClick={onResolveConstraints} type="button">
                进入重点前先核对家庭规则
              </button>
            ) : null}
            <button disabled={busy} onClick={() => onMove("basic_shortlist")} type="button">
              移除到基础候选
            </button>
          </>
        ) : (
          <span className="ui-status">
            {item.stage === "comparison" ? "已在重点候选" : "已在定稿名单"}
          </span>
        )}
      </div>
      {!excluded && item.stage !== "finalist" ? (
        <details className="candidate-dismiss">
          <summary>排除这个名字</summary>
          <input
            aria-label={`排除理由${item.fullName}`}
            onChange={(event) => onRejectionReasonChange(event.target.value)}
            placeholder="可选：记下原因"
            value={rejectionReason}
          />
          <button disabled={busy} onClick={() => onMove("excluded")} type="button">
            排除
          </button>
        </details>
      ) : null}
    </Card>
  );
}
