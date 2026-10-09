import { z } from "zod";
import { validateBirthDateTime } from "../folklore/birthDate";

const nonEmptyText = z.string().trim().min(1);
const singleCharacter = z.string().trim().length(1);

export const namingProfileSchema = z
  .object({
    projectId: nonEmptyText,
    surname: nonEmptyText.max(4).regex(/^\p{Script=Han}+$/u, "姓氏请使用汉字"),
    surnamePinyin: z.string().trim().max(80).optional(),
    surnameType: z.enum(["single", "compound", "combined_parental"]),
    givenNameLength: z.union([z.literal(1), z.literal(2)]),
    childGender: z.enum(["male", "female", "unknown"]).optional(),
    constraintKnowledge: z.enum(["present", "none", "unknown"]).optional(),
    requiredCharacters: z.array(
      z.object({
        char: singleCharacter,
        position: z.union([z.literal(1), z.literal(2), z.literal("any")]),
      }),
    ),
    generationCharacters: z.array(singleCharacter),
    avoidCharacters: z.array(singleCharacter),
    relativeNames: z.array(nonEmptyText),
    forbiddenCombinations: z.array(nonEmptyText),
    genderExpression: z.enum(["unrestricted", "neutral", "masculine", "feminine"]),
    styleTags: z.array(nonEmptyText),
    dialectNotes: z.string().trim().max(500).optional(),
    writingComplexity: z.enum(["simple", "balanced", "unrestricted"]),
    pinyinFriendly: z.boolean(),
    folklore: z.object({
      enabled: z.boolean(),
      dayBoundary: z.enum(["midnight", "zi"]).optional(),
      timeKnown: z.boolean().optional(),
      birthLocalDateTime: z.string().optional(),
      timeZone: z.string().optional(),
      usefulElements: z.array(z.enum(["wood", "fire", "earth", "metal", "water"])),
      includeInRanking: z.boolean(),
    }),
  })
  .superRefine((profile, context) => {
    if (profile.surnameType === "single" && [...profile.surname].length !== 1)
      context.addIssue({
        code: "custom",
        message: "单姓应为一个汉字，复姓请选择相应结构",
        path: ["surname"],
      });
    const positions = profile.requiredCharacters.filter((item) => item.position !== "any");
    if (
      positions.some((item, i) =>
        positions
          .slice(i + 1)
          .some((other) => other.position === item.position && other.char !== item.char),
      )
    )
      context.addIssue({
        code: "custom",
        message: "同一位置不能指定不同的字",
        path: ["requiredCharacters"],
      });
    if (profile.folklore.enabled && profile.folklore.birthLocalDateTime) {
      const error = validateBirthDateTime(
        profile.folklore.birthLocalDateTime,
        profile.folklore.timeKnown !== false,
      );
      if (error)
        context.addIssue({
          code: "custom",
          message: error,
          path: ["folklore", "birthLocalDateTime"],
        });
      if (profile.folklore.timeZone && profile.folklore.timeZone !== "Asia/Shanghai")
        context.addIssue({
          code: "custom",
          message: "请选择中国标准时间 Asia/Shanghai",
          path: ["folklore", "timeZone"],
        });
    }
    if (profile.requiredCharacters.some(({ char }) => profile.avoidCharacters.includes(char)))
      context.addIssue({
        code: "custom",
        message: "指定字与避字不能冲突",
        path: ["requiredCharacters"],
      });
    if (
      profile.constraintKnowledge === "present" &&
      profile.requiredCharacters.length === 0 &&
      profile.avoidCharacters.length === 0 &&
      profile.relativeNames.length === 0
    )
      context.addIssue({
        code: "custom",
        message: "请至少填写一项必须遵守的字辈或避讳",
        path: ["constraintKnowledge"],
      });
    if (
      new Set(profile.requiredCharacters.map((item) => item.char)).size >
      profile.givenNameLength
    )
      context.addIssue({
        code: "custom",
        message: "指定字数量超过名字长度",
        path: ["requiredCharacters"],
      });
    if (
      profile.givenNameLength === 1 &&
      profile.requiredCharacters.some((requirement) => requirement.position === 2)
    ) {
      context.addIssue({
        code: "custom",
        message: "一字名不能把指定字固定在第二位",
        path: ["requiredCharacters"],
      });
    }
  });

export type NamingProfile = z.infer<typeof namingProfileSchema>;

export function familyRulesArePending(
  profile: Pick<NamingProfile, "constraintKnowledge">,
): boolean {
  return profile.constraintKnowledge !== "present" && profile.constraintKnowledge !== "none";
}
