import { z } from "zod";

export const projectFormSchema = z.object({
  title: z.string().trim().min(1, "请填写方案名称").max(80),
  surname: z.string().trim().min(1, "请填写姓氏").max(4),
  surnameType: z.enum(["single", "compound", "combined_parental"]),
  givenNameLength: z.union([z.literal(1), z.literal(2)]),
  requiredCharactersText: z.string(),
  avoidCharactersText: z.string(),
  relativeNamesText: z.string(),
  styleTags: z.array(z.string()),
  genderExpression: z.enum(["unrestricted", "neutral", "masculine", "feminine"]),
  writingComplexity: z.enum(["simple", "balanced", "unrestricted"]),
  pinyinFriendly: z.boolean(),
  folkloreEnabled: z.boolean(),
  birthLocalDateTime: z.string(),
  timeZone: z.string(),
  usefulElements: z.array(z.enum(["wood", "fire", "earth", "metal", "water"])),
  includeFolkloreInRanking: z.boolean(),
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
    usefulElements: ProjectFormValues["usefulElements"];
    includeInRanking: boolean;
  };
}

export function toCompleteOnboardingInput(values: ProjectFormValues): CompleteOnboardingInput {
  return {
    title: values.title.trim(),
    surname: values.surname.trim(),
    surnameType: values.surnameType,
    givenNameLength: values.givenNameLength,
    requiredCharacters: splitChineseList(values.requiredCharactersText),
    avoidCharacters: splitChineseList(values.avoidCharactersText),
    relativeNames: splitChineseList(values.relativeNamesText),
    styleTags: values.styleTags,
    genderExpression: values.genderExpression,
    writingComplexity: values.writingComplexity,
    pinyinFriendly: values.pinyinFriendly,
    folklore: {
      enabled: values.folkloreEnabled,
      ...(values.birthLocalDateTime ? { birthLocalDateTime: values.birthLocalDateTime } : {}),
      ...(values.timeZone ? { timeZone: values.timeZone } : {}),
      usefulElements: values.usefulElements,
      includeInRanking: values.includeFolkloreInRanking,
    },
  };
}
