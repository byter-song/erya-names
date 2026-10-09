import { z } from "zod";

export const projectFormSchema = z
  .object({
    title: z.string().trim().min(1, "请填写方案名称").max(80, "方案名称不能超过 80 个字符"),
    surname: z
      .string()
      .trim()
      .min(1, "请填写姓氏")
      .max(4, "姓氏不能超过 4 个汉字")
      .regex(/^\p{Script=Han}+$/u, "姓氏请使用汉字"),
    surnameType: z.enum(["single", "compound", "combined_parental"]),
    givenNameLength: z.union([z.literal(1), z.literal(2)]),
    childGender: z.enum(["male", "female", "unknown"]),
    constraintKnowledge: z.enum(["present", "none", "unknown"]),
    requiredCharactersText: z.string(),
    avoidCharactersText: z.string(),
    relativeNamesText: z.string(),
    styleTags: z.array(z.string()),
    genderExpression: z.enum(["unrestricted", "neutral", "masculine", "feminine"]),
    writingComplexity: z.enum(["simple", "balanced", "unrestricted"]),
    pinyinFriendly: z.boolean(),
  })
  .superRefine((values, context) => {
    if (values.surnameType === "single" && [...values.surname.trim()].length !== 1)
      context.addIssue({
        code: "custom",
        message: "单姓应为一个汉字，复姓请选择相应结构",
        path: ["surname"],
      });
    if (
      values.constraintKnowledge === "present" &&
      !values.requiredCharactersText.trim() &&
      !values.avoidCharactersText.trim() &&
      !values.relativeNamesText.trim()
    )
      context.addIssue({
        code: "custom",
        message: "请至少填写一项必须遵守的字辈或避讳",
        path: ["requiredCharactersText"],
      });
  });

export type ProjectFormValues = z.infer<typeof projectFormSchema>;

function splitChineseList(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[，,、\s]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

export interface CompleteOnboardingInput {
  title: string;
  surname: string;
  surnameType: ProjectFormValues["surnameType"];
  givenNameLength: ProjectFormValues["givenNameLength"];
  childGender: ProjectFormValues["childGender"];
  constraintKnowledge: ProjectFormValues["constraintKnowledge"];
  requiredCharacters: string[];
  avoidCharacters: string[];
  relativeNames: string[];
  styleTags: string[];
  genderExpression: ProjectFormValues["genderExpression"];
  writingComplexity: ProjectFormValues["writingComplexity"];
  pinyinFriendly: boolean;
  folklore: {
    enabled: boolean;
    birthLocalDateTime?: string;
    timeZone?: string;
    usefulElements: [];
    includeInRanking: boolean;
  };
}

export function toCompleteOnboardingInput(values: ProjectFormValues): CompleteOnboardingInput {
  const hasConfirmedRules = values.constraintKnowledge === "present";
  return {
    title: values.title.trim(),
    surname: values.surname.trim(),
    surnameType: values.surnameType,
    givenNameLength: values.givenNameLength,
    childGender: values.childGender,
    constraintKnowledge: values.constraintKnowledge,
    requiredCharacters: hasConfirmedRules
      ? splitChineseList(values.requiredCharactersText)
      : [],
    avoidCharacters: hasConfirmedRules ? splitChineseList(values.avoidCharactersText) : [],
    relativeNames: hasConfirmedRules ? splitChineseList(values.relativeNamesText) : [],
    styleTags: values.styleTags,
    genderExpression: values.genderExpression,
    writingComplexity: values.writingComplexity,
    pinyinFriendly: values.pinyinFriendly,
    folklore: {
      enabled: false,
      usefulElements: [],
      includeInRanking: false,
    },
  };
}
