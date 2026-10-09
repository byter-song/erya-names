import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm, type FieldErrors, type FieldPath } from "react-hook-form";
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

export function OnboardingWizard({
  defaultSurname = "",
  currentStep,
  onStepChange,
  onComplete,
}: {
  defaultSurname?: string;
  currentStep?: number;
  onStepChange?: (step: number) => void;
  onComplete: (input: CompleteOnboardingInput) => Promise<void>;
}) {
  const [initialValues] = useState<ProjectFormValues>(() =>
    loadDraft({
      title: defaultTitle(defaultSurname),
      surname: defaultSurname,
      surnameType: "single",
      givenNameLength: 2,
      childGender: "unknown",
      constraintKnowledge: "unknown",
      requiredCharactersText: "",
      avoidCharactersText: "",
      relativeNamesText: "",
      styleTags: [],
      genderExpression: "unrestricted",
      writingComplexity: "balanced",
      pinyinFriendly: false,
    }),
  );
  const [internalStep, setInternalStep] = useState(1);
  const step = currentStep ?? internalStep;
  const automaticTitle = useRef(defaultTitle(initialValues.surname));
  const titleIsAutomatic = useRef(initialValues.title === automaticTitle.current);
  const [submitError, setSubmitError] = useState<string>();
  const { register, handleSubmit, watch, formState, setFocus, setValue, trigger } =
    useForm<ProjectFormValues>({
      resolver: zodResolver(projectFormSchema),
      defaultValues: initialValues,
    });
  const titleField = register("title");
  const surnameField = register("surname");
  const constraintKnowledge = watch("constraintKnowledge");

  const moveToStep = (next: number) => {
    if (onStepChange) onStepChange(next);
    else setInternalStep(next);
  };

  useEffect(() => {
    const subscription = watch((values) => {
      try {
        localStorage.setItem(
          ONBOARDING_DRAFT_KEY,
          JSON.stringify({
            draftSchemaVersion: 2,
            savedAt: Date.now(),
            title: values.title,
            surname: values.surname,
            surnameType: values.surnameType,
            givenNameLength: values.givenNameLength,
            childGender: values.childGender,
            constraintKnowledge: values.constraintKnowledge,
            styleTags: values.styleTags,
            genderExpression: values.genderExpression,
            writingComplexity: values.writingComplexity,
            pinyinFriendly: values.pinyinFriendly,
          }),
        );
      } catch {
        // The form remains usable when private browsing or storage quotas block drafts.
      }
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  const complete = handleSubmit(
    async (values) => {
      setSubmitError(undefined);
      try {
        await onComplete(toCompleteOnboardingInput(values));
        localStorage.removeItem(ONBOARDING_DRAFT_KEY);
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : "建档失败，请重试");
      }
    },
    (errors) => focusFirstInvalidStep(errors, moveToStep, setFocus, setSubmitError),
  );

  const nextStep = async () => {
    setSubmitError(undefined);
    const fields = stepFields[step] ?? [];
    if (await trigger(fields, { shouldFocus: true })) moveToStep(step + 1);
  };

  return (
    <main className="onboarding">
      <Card className="onboarding__card">
        <OnboardingProgress current={step} total={3} />
        <header>
          <p className="project-center__kicker">CREATE NAMING PROJECT</p>
          <h1>创建起名方案</h1>
        </header>
        <form onSubmit={(event) => void complete(event)}>
          {step === 1 ? (
            <div className="onboarding__fields">
              <label>
                方案名称
                <input
                  aria-describedby={formState.errors.title ? "title-error" : undefined}
                  aria-invalid={Boolean(formState.errors.title)}
                  aria-label="方案名称"
                  {...titleField}
                  onChange={(event) => {
                    titleIsAutomatic.current = event.target.value === automaticTitle.current;
                    void titleField.onChange(event);
                  }}
                />
                {formState.errors.title ? (
                  <span id="title-error" role="alert">
                    {formState.errors.title.message}
                  </span>
                ) : null}
              </label>
              <label>
                姓氏
                <input
                  aria-describedby={formState.errors.surname ? "surname-error" : undefined}
                  aria-invalid={Boolean(formState.errors.surname)}
                  aria-label="姓氏"
                  {...surnameField}
                  onChange={(event) => {
                    void surnameField.onChange(event);
                    if (titleIsAutomatic.current) {
                      const nextTitle = defaultTitle(event.target.value);
                      automaticTitle.current = nextTitle;
                      setValue("title", nextTitle, { shouldValidate: true });
                    }
                  }}
                />
                {formState.errors.surname ? (
                  <span id="surname-error" role="alert">
                    {formState.errors.surname.message}
                  </span>
                ) : null}
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
              <fieldset className="onboarding__wide">
                <legend>宝宝性别</legend>
                {[
                  ["male", "男孩"],
                  ["female", "女孩"],
                  ["unknown", "暂未确定"],
                ].map(([value, label]) => (
                  <label className="onboarding__choice" key={value}>
                    <input type="radio" value={value} {...register("childGender")} />
                    {label}
                  </label>
                ))}
                <p>性别只作为默认软排序参照，不限制跨风格名字。</p>
              </fieldset>
            </div>
          ) : null}
          {step === 2 ? (
            <div className="onboarding__fields">
              <fieldset className="onboarding__wide">
                <legend>有必须遵守的字辈或避讳吗？</legend>
                {[
                  ["present", "有"],
                  ["none", "没有"],
                  ["unknown", "不确定"],
                ].map(([value, label]) => (
                  <label className="onboarding__choice" key={value}>
                    <input type="radio" value={value} {...register("constraintKnowledge")} />
                    {label}
                  </label>
                ))}
              </fieldset>
              {constraintKnowledge === "present" ? (
                <>
                  <label>
                    指定字
                    <input
                      aria-label="指定字"
                      placeholder="例如：克,玲，龙（支持 ,，、和空格）"
                      {...register("requiredCharactersText")}
                    />
                  </label>
                  <label>
                    避字
                    <input
                      aria-label="避字"
                      placeholder="例如：克,玲，龙（支持 ,，、和空格）"
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
                </>
              ) : (
                <p className="onboarding__wide">
                  {constraintKnowledge === "unknown"
                    ? "可以先看灵感；核对前不能进入重点候选或定稿名单。"
                    : "已确认没有必须遵守的字辈或避讳。"}
                </p>
              )}
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
          {submitError ? (
            <p className="onboarding__error" role="alert">
              {submitError}
            </p>
          ) : null}
          <footer className="onboarding__actions">
            {step > 1 ? (
              <button onClick={() => moveToStep(step - 1)} type="button">
                上一步
              </button>
            ) : (
              <span />
            )}
            {step < 3 ? (
              <span className="onboarding__actions-primary">
                {step === 2 && constraintKnowledge !== "present" ? (
                  <Button key="quick-complete" type="submit" disabled={formState.isSubmitting}>
                    使用默认设置，开始选名
                  </Button>
                ) : null}
                <Button
                  key="next-step"
                  onClick={(event) => {
                    event.preventDefault();
                    void nextStep();
                  }}
                  type="button"
                >
                  下一步
                </Button>
              </span>
            ) : (
              <Button key="complete-onboarding" type="submit" disabled={formState.isSubmitting}>
                完成建档，开始选名
              </Button>
            )}
          </footer>
        </form>
      </Card>
    </main>
  );
}

const stepFields: Record<number, FieldPath<ProjectFormValues>[]> = {
  1: ["title", "surname", "surnameType", "givenNameLength", "childGender"],
  2: [
    "constraintKnowledge",
    "requiredCharactersText",
    "avoidCharactersText",
    "relativeNamesText",
  ],
  3: ["styleTags", "genderExpression", "writingComplexity", "pinyinFriendly"],
};

function defaultTitle(surname: string): string {
  return surname.trim() ? `${surname.trim()}姓宝宝起名` : "宝宝起名";
}

function focusFirstInvalidStep(
  errors: FieldErrors<ProjectFormValues>,
  moveToStep: (step: number) => void,
  setFocus: (field: FieldPath<ProjectFormValues>) => void,
  setSubmitError: (message: string) => void,
) {
  const target = Object.entries(stepFields)
    .flatMap(([step, fields]) => fields.map((field) => ({ step: Number(step), field })))
    .find(({ field }) => errors[field as keyof ProjectFormValues]);
  const firstField = target?.field;
  const targetStep = target?.step ?? 1;
  moveToStep(targetStep);
  const firstError = firstField ? errors[firstField as keyof ProjectFormValues] : undefined;
  setSubmitError(
    firstError && "message" in firstError
      ? String(firstError.message ?? "请检查必填信息")
      : "请检查当前方案信息。",
  );
  if (firstField) requestAnimationFrame(() => setFocus(firstField));
}

function loadDraft(defaultValues: ProjectFormValues): ProjectFormValues {
  try {
    const value = localStorage.getItem(ONBOARDING_DRAFT_KEY);
    if (!value) return defaultValues;
    const draft = JSON.parse(value) as Record<string, unknown>;
    if (
      draft.draftSchemaVersion !== 2 ||
      typeof draft.savedAt !== "number" ||
      Date.now() - draft.savedAt > 24 * 60 * 60 * 1_000
    ) {
      localStorage.removeItem(ONBOARDING_DRAFT_KEY);
      return defaultValues;
    }
    const allowedKeys = [
      "title",
      "surname",
      "surnameType",
      "givenNameLength",
      "childGender",
      "constraintKnowledge",
      "styleTags",
      "genderExpression",
      "writingComplexity",
      "pinyinFriendly",
    ] as const;
    const allowed = Object.fromEntries(
      allowedKeys.flatMap((key) => (draft[key] === undefined ? [] : [[key, draft[key]]])),
    );
    return projectFormSchema.parse({ ...defaultValues, ...allowed });
  } catch {
    localStorage.removeItem(ONBOARDING_DRAFT_KEY);
    return defaultValues;
  }
}
