import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "../../design-system/primitives/Button";
import { Card } from "../../design-system/primitives/Card";
import { OnboardingProgress } from "./OnboardingProgress";
import {
  projectFormSchema,
  toCompleteOnboardingInput,
  type CompleteOnboardingInput,
  type ProjectFormValues,
} from "./projectFormSchema";
import "./onboarding.css";
import { ONBOARDING_DRAFT_KEY } from "../../infrastructure/persistence/LocalDraftWriter";

const styleOptions = ["清朗自然", "文雅书卷", "沉稳端正", "中性现代"];
const elementOptions = [
  ["wood", "木"],
  ["fire", "火"],
  ["earth", "土"],
  ["metal", "金"],
  ["water", "水"],
] as const;

export function OnboardingWizard({
  defaultSurname = "宋",
  onComplete,
}: {
  defaultSurname?: string;
  onComplete: (input: CompleteOnboardingInput) => Promise<void>;
}) {
  const [step, setStep] = useState(1);
  const [submitError, setSubmitError] = useState<string>();
  const { register, handleSubmit, watch, formState } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: loadDraft({
      title: `${defaultSurname}姓宝宝起名`,
      surname: defaultSurname,
      surnameType: "single",
      givenNameLength: 2,
      requiredCharactersText: "",
      avoidCharactersText: "",
      relativeNamesText: "",
      styleTags: [],
      genderExpression: "unrestricted",
      writingComplexity: "balanced",
      pinyinFriendly: false,
      folkloreEnabled: false,
      birthLocalDateTime: "",
      timeZone: "Asia/Shanghai",
      usefulElements: [],
      includeFolkloreInRanking: false,
    }),
  });
  const folkloreEnabled = watch("folkloreEnabled");

  useEffect(() => {
    const subscription = watch((values) => {
      localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(values));
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  const complete = handleSubmit(async (values) => {
    setSubmitError(undefined);
    try {
      await onComplete(toCompleteOnboardingInput(values));
      localStorage.removeItem(ONBOARDING_DRAFT_KEY);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "建档失败，请重试");
    }
  });

  return (
    <main className="onboarding">
      <Card className="onboarding__card">
        <OnboardingProgress current={step} total={4} />
        <header>
          <p className="project-center__kicker">CREATE NAMING PROJECT</p>
          <h1>创建起名方案</h1>
        </header>
        <form onSubmit={(event) => void complete(event)}>
          {step === 1 ? (
            <div className="onboarding__fields">
              <label>
                方案名称
                <input aria-label="方案名称" {...register("title")} />
              </label>
              <label>
                姓氏
                <input aria-label="姓氏" {...register("surname")} />
              </label>
              <label>
                姓氏类型
                <select aria-label="姓氏类型" {...register("surnameType")}>
                  <option value="single">单姓</option>
                  <option value="compound">传统复姓</option>
                  <option value="combined_parental">父母组合姓</option>
                </select>
              </label>
              <label>
                名字长度
                <select
                  aria-label="名字长度"
                  {...register("givenNameLength", { valueAsNumber: true })}
                >
                  <option value="2">二字名</option>
                  <option value="1">一字名</option>
                </select>
              </label>
            </div>
          ) : null}
          {step === 2 ? (
            <div className="onboarding__fields">
              <label>
                指定字
                <input
                  aria-label="指定字"
                  placeholder="例如：知、远"
                  {...register("requiredCharactersText")}
                />
              </label>
              <label>
                避字
                <input
                  aria-label="避字"
                  placeholder="例如：病、殇"
                  {...register("avoidCharactersText")}
                />
              </label>
              <label className="onboarding__wide">
                亲属姓名
                <textarea
                  aria-label="亲属姓名"
                  placeholder="用于识别重复与避讳"
                  {...register("relativeNamesText")}
                />
              </label>
            </div>
          ) : null}
          {step === 3 ? (
            <div className="onboarding__fields">
              <fieldset className="onboarding__wide">
                <legend>风格偏好</legend>
                {styleOptions.map((style) => (
                  <label className="onboarding__choice" key={style}>
                    <input
                      aria-label={style}
                      type="checkbox"
                      value={style}
                      {...register("styleTags")}
                    />
                    {style}
                  </label>
                ))}
              </fieldset>
              <label>
                性别表达
                <select aria-label="性别表达" {...register("genderExpression")}>
                  <option value="unrestricted">不限</option>
                  <option value="neutral">中性</option>
                  <option value="masculine">偏阳刚</option>
                  <option value="feminine">偏柔美</option>
                </select>
              </label>
              <label>
                书写复杂度
                <select aria-label="书写复杂度" {...register("writingComplexity")}>
                  <option value="balanced">均衡</option>
                  <option value="simple">简单</option>
                  <option value="unrestricted">不限</option>
                </select>
              </label>
              <label className="onboarding__choice">
                <input type="checkbox" {...register("pinyinFriendly")} />
                重视拼音友好
              </label>
            </div>
          ) : null}
          {step === 4 ? (
            <div className="onboarding__fields">
              <label className="onboarding__choice onboarding__wide">
                <input
                  aria-label="启用基础民俗参考"
                  type="checkbox"
                  {...register("folkloreEnabled")}
                />
                启用基础民俗参考
              </label>
              {folkloreEnabled ? (
                <>
                  <label>
                    出生时间
                    <input
                      aria-label="出生时间"
                      type="datetime-local"
                      {...register("birthLocalDateTime")}
                    />
                  </label>
                  <fieldset>
                    <legend>用户指定喜用五行</legend>
                    {elementOptions.map(([value, label]) => (
                      <label className="onboarding__choice" key={value}>
                        <input type="checkbox" value={value} {...register("usefulElements")} />
                        {label}
                      </label>
                    ))}
                  </fieldset>
                  <label className="onboarding__choice onboarding__wide">
                    <input type="checkbox" {...register("includeFolkloreInRanking")} />
                    纳入软排序
                  </label>
                </>
              ) : (
                <p className="onboarding__wide">
                  默认关闭。开启后可查看节气四柱、生肖口径、藏干纳音与五行分布；名字详情提供民俗说明及五格公式。不自动判断喜用神，不推断命运。
                </p>
              )}
            </div>
          ) : null}

          {Object.keys(formState.errors).length > 0 ? (
            <p className="onboarding__error">请检查当前方案信息。</p>
          ) : null}
          {submitError ? <p className="onboarding__error">{submitError}</p> : null}
          <footer className="onboarding__actions">
            {step > 1 ? (
              <button onClick={() => setStep((value) => value - 1)} type="button">
                上一步
              </button>
            ) : (
              <span />
            )}
            {step < 4 ? (
              <Button
                key="next-step"
                onClick={(event) => {
                  event.preventDefault();
                  setStep((value) => value + 1);
                }}
                type="button"
              >
                下一步
              </Button>
            ) : (
              <Button key="complete-onboarding" type="submit" disabled={formState.isSubmitting}>
                完成建档并生成姓名
              </Button>
            )}
          </footer>
        </form>
      </Card>
    </main>
  );
}

function loadDraft(defaultValues: ProjectFormValues): ProjectFormValues {
  try {
    const value = localStorage.getItem(ONBOARDING_DRAFT_KEY);
    return value ? projectFormSchema.parse(JSON.parse(value)) : defaultValues;
  } catch {
    localStorage.removeItem(ONBOARDING_DRAFT_KEY);
    return defaultValues;
  }
}
