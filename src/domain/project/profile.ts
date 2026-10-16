import { validateBirthDateTime } from "../folklore/birthDate";
import { z, type Infer } from "../shared/zod";

const nonEmptyText = z.string().trim().min(1);
const singleCharacter = z.string().trim().length(1);
const elementSchema = z.enum(["wood", "fire", "earth", "metal", "water"]);

export const folkloreModuleIdSchema = z.enum([
  "bazi_wuxing",
  "zodiac",
  "traditional",
  "name_hexagram",
  "five_grids",
]);

export const folkloreModuleConfigSchema = z
  .object({
    analysisEnabled: z.boolean(),
    detailsVisible: z.boolean(),
    weight: z.number().min(0).max(100),
    schoolId: nonEmptyText,
    ruleVersion: nonEmptyText,
  })
  .superRefine((module, context) => {
    if (module.analysisEnabled && module.weight === 0)
      context.addIssue({
        code: "custom",
        message: "启用分析的模块权重必须大于 0",
        path: ["weight"],
      });
  });

const relativeAvoidanceSchema = z.object({
  fullName: nonEmptyText.max(20).regex(/^\p{Script=Han}+$/u, "亲属姓名请使用汉字"),
  givenName: z
    .string()
    .trim()
    .max(4)
    .regex(/^\p{Script=Han}*$/u, "亲属的名请使用汉字"),
  mode: z.enum(["whole-name", "same-character", "same-sound"]),
  pinyin: z.array(z.string().trim().min(1).max(20)).max(4),
});

const basicsSchema = z.object({
  surname: nonEmptyText.max(4).regex(/^\p{Script=Han}+$/u, "姓氏请使用汉字"),
  surnamePinyin: z.string().trim().max(80).optional(),
  surnameType: z.enum(["single", "compound", "combined_parental"]),
  givenNameLength: z.union([z.literal(1), z.literal(2)]),
  childGender: z.enum(["male", "female", "unknown"]).optional(),
  genderExpression: z.enum(["unrestricted", "neutral", "masculine", "feminine"]),
  styleTags: z.array(nonEmptyText),
  dialectNotes: z.string().trim().max(500).optional(),
  writingComplexity: z.enum(["simple", "balanced", "unrestricted"]),
  pinyinFriendly: z.boolean(),
});

const familySchema = z.object({
  constraintKnowledge: z.enum(["present", "none", "unknown"]),
  requiredCharacters: z.array(
    z.object({
      char: singleCharacter,
      position: z.union([z.literal(1), z.literal(2), z.literal("any")]),
    }),
  ),
  generationCharacters: z.array(singleCharacter),
  avoidCharacters: z.array(singleCharacter),
  relativeNames: z.array(nonEmptyText),
  relativeAvoidances: z.array(relativeAvoidanceSchema).max(30).optional(),
  forbiddenCombinations: z.array(nonEmptyText),
});

const inspirationSchema = z.object({
  sources: z.array(z.enum(["poetry", "modern", "historical"])).min(1),
});

const calendarSchema = z.object({
  birthLocalDateTime: z.string().optional(),
  timeKnown: z.boolean(),
  timeZone: nonEmptyText,
  dayBoundary: z.enum(["midnight", "zi"]),
  zodiacConvention: z.enum(["lunar", "pillar"]),
  trueSolarTimeCorrection: z.literal("not_applied").default("not_applied"),
  historicalDstCorrection: z.literal("not_applied").default("not_applied"),
});

const usefulGodDecisionSchema = z.object({
  confirmedElements: z.array(elementSchema).min(1),
  confirmedAt: z.iso.datetime(),
  note: z.string().trim().max(500).optional(),
});

export const namingProfileSchema = z
  .object({
    projectId: nonEmptyText,
    configRevision: z.number().int().nonnegative(),
    basics: basicsSchema,
    family: familySchema,
    inspiration: inspirationSchema,
    calendar: calendarSchema,
    modules: z.object({
      bazi_wuxing: folkloreModuleConfigSchema,
      zodiac: folkloreModuleConfigSchema,
      traditional: folkloreModuleConfigSchema,
      name_hexagram: folkloreModuleConfigSchema,
      five_grids: folkloreModuleConfigSchema,
    }),
    scoring: z.object({
      presetId: nonEmptyText,
      presetVersion: nonEmptyText,
      basicWeight: z.number().min(0).max(100),
    }),
    usefulGodDecision: usefulGodDecisionSchema.optional(),
  })
  .superRefine((profile, context) => {
    const { basics, family, calendar } = profile;
    if (basics.surnameType === "single" && [...basics.surname].length !== 1)
      context.addIssue({
        code: "custom",
        message: "单姓应为一个汉字，复姓请选择相应结构",
        path: ["basics", "surname"],
      });

    const fixedPositions = family.requiredCharacters.filter((item) => item.position !== "any");
    if (
      fixedPositions.some((item, index) =>
        fixedPositions
          .slice(index + 1)
          .some((other) => other.position === item.position && other.char !== item.char),
      )
    )
      context.addIssue({
        code: "custom",
        message: "同一位置不能指定不同的字",
        path: ["family", "requiredCharacters"],
      });

    if (family.requiredCharacters.some(({ char }) => family.avoidCharacters.includes(char)))
      context.addIssue({
        code: "custom",
        message: "指定字与避字不能冲突",
        path: ["family", "requiredCharacters"],
      });

    if (
      family.constraintKnowledge === "present" &&
      family.requiredCharacters.length === 0 &&
      family.avoidCharacters.length === 0 &&
      family.relativeNames.length === 0 &&
      !family.relativeAvoidances?.length
    )
      context.addIssue({
        code: "custom",
        message: "请至少填写一项必须遵守的字辈或避讳",
        path: ["family", "constraintKnowledge"],
      });

    family.relativeAvoidances?.forEach((rule, index) => {
      if (
        rule.mode !== "whole-name" &&
        (!rule.givenName || !rule.fullName.endsWith(rule.givenName))
      )
        context.addIssue({
          code: "custom",
          message: "请明确填写亲属姓名中不含姓氏的名",
          path: ["family", "relativeAvoidances", index, "givenName"],
        });
      if (
        rule.mode === "same-sound" &&
        (rule.pinyin.length !== [...rule.givenName].length ||
          rule.pinyin.some(
            (syllable) => !/^[a-züǖǘǚǜāáǎàēéěèīíǐìōóǒòūúǔùńňǹḿ]+[1-5]?$/iu.test(syllable),
          ))
      )
        context.addIssue({
          code: "custom",
          message: "同音避讳请按亲属的名逐字填写普通话拼音",
          path: ["family", "relativeAvoidances", index, "pinyin"],
        });
    });

    if (
      new Set(family.requiredCharacters.map((item) => item.char)).size > basics.givenNameLength
    )
      context.addIssue({
        code: "custom",
        message: "指定字数量超过名字长度",
        path: ["family", "requiredCharacters"],
      });
    if (
      basics.givenNameLength === 1 &&
      family.requiredCharacters.some((requirement) => requirement.position === 2)
    )
      context.addIssue({
        code: "custom",
        message: "一字名不能把指定字固定在第二位",
        path: ["family", "requiredCharacters"],
      });

    if (calendar.birthLocalDateTime) {
      const error = validateBirthDateTime(calendar.birthLocalDateTime, calendar.timeKnown);
      if (error)
        context.addIssue({
          code: "custom",
          message: error,
          path: ["calendar", "birthLocalDateTime"],
        });
    }
  });

export type FolkloreModuleId = Infer<typeof folkloreModuleIdSchema>;
export type FolkloreModuleConfig = Infer<typeof folkloreModuleConfigSchema>;
export type NamingProfile = Infer<typeof namingProfileSchema>;
export type NamingProfileDraft = Omit<NamingProfile, "projectId" | "configRevision">;

export function familyRulesArePending(
  family: Pick<NamingProfile["family"], "constraintKnowledge">,
): boolean {
  return family.constraintKnowledge !== "present" && family.constraintKnowledge !== "none";
}
