import type { ProjectRepository } from "../ports/ProjectRepository";
import { ZodError } from "../../domain/shared/zod";
import { namingProfileSchema, type NamingProfile } from "../../domain/project/profile";
import { namingProjectSchema } from "../../domain/project/project";
import { err, ok, type Result } from "../../domain/shared/result";

export interface CreateNamingProjectInput {
  profile?: {
    basics?: Partial<NamingProfile["basics"]>;
    family?: Partial<NamingProfile["family"]>;
    inspiration?: Partial<NamingProfile["inspiration"]>;
    calendar?: Partial<NamingProfile["calendar"]>;
    modules?: Partial<NamingProfile["modules"]>;
    scoring?: Partial<NamingProfile["scoring"]>;
    usefulGodDecision?: NamingProfile["usefulGodDecision"];
  };
  completeOnboarding?: boolean;
  title: string;
  surname: string;
  surnameType: "single" | "compound" | "combined_parental";
  givenNameLength: 1 | 2;
}

export class CreateNamingProject {
  constructor(
    private readonly repository: ProjectRepository,
    private readonly dependencies: { createId: () => string; now: () => string },
  ) {}

  async execute(
    input: CreateNamingProjectInput,
  ): Promise<Result<{ projectId: string }, string>> {
    try {
      const projectId = this.dependencies.createId();
      const now = this.dependencies.now();
      const project = namingProjectSchema.parse({
        id: projectId,
        title: input.title,
        stage: input.completeOnboarding ? "naming" : "configuration",
        status: input.completeOnboarding ? "active" : "draft",
        createdAt: now,
        updatedAt: now,
      });
      const defaults: NamingProfile = {
        projectId,
        configRevision: 0,
        basics: {
          surname: input.surname,
          surnameType: input.surnameType,
          givenNameLength: input.givenNameLength,
          childGender: "unknown",
          genderExpression: "unrestricted",
          styleTags: [],
          writingComplexity: "balanced",
          pinyinFriendly: false,
        },
        family: {
          constraintKnowledge: "unknown",
          requiredCharacters: [],
          generationCharacters: [],
          avoidCharacters: [],
          relativeNames: [],
          relativeAvoidances: [],
          forbiddenCombinations: [],
        },
        inspiration: { sources: ["poetry", "modern", "historical"] },
        calendar: {
          timeKnown: false,
          timeZone: "Asia/Shanghai",
          dayBoundary: "midnight",
          zodiacConvention: "pillar",
          trueSolarTimeCorrection: "not_applied",
          historicalDstCorrection: "not_applied",
        },
        modules: {
          bazi_wuxing: enabledModule("four-path-useful-god-v1", "1.0.0", 35),
          zodiac: enabledModule("zodiac-radical-hints-v1", "1.0.0", 10),
          traditional: enabledModule("zuozhuan-naming-principles-v1", "1.0.0", 15),
          name_hexagram: disabledModule("meihua-name-stroke-erya-v1", "1.0.0"),
          five_grids: disabledModule("kumasaki-five-grid-1930-ndl-v1", "1.0.0"),
        },
        scoring: { presetId: "traditional-core", presetVersion: "1", basicWeight: 40 },
      };
      const profile = namingProfileSchema.parse({
        ...defaults,
        basics: { ...defaults.basics, ...input.profile?.basics },
        family: { ...defaults.family, ...input.profile?.family },
        inspiration: { ...defaults.inspiration, ...input.profile?.inspiration },
        calendar: { ...defaults.calendar, ...input.profile?.calendar },
        modules: { ...defaults.modules, ...input.profile?.modules },
        scoring: { ...defaults.scoring, ...input.profile?.scoring },
        usefulGodDecision: input.profile?.usefulGodDecision,
      });

      const created = await this.repository.create({ project, profile });
      if (!created.ok) return err(created.error);
      return ok({ projectId });
    } catch (error) {
      return err(
        error instanceof ZodError
          ? error.issues.map((issue) => issue.message).join("；")
          : error instanceof Error
            ? error.message
            : "Unable to create project",
      );
    }
  }
}

function disabledModule(
  schoolId: string,
  ruleVersion: string,
): NamingProfile["modules"][keyof NamingProfile["modules"]] {
  return {
    analysisEnabled: false,
    detailsVisible: true,
    weight: 0,
    schoolId,
    ruleVersion,
  };
}

function enabledModule(
  schoolId: string,
  ruleVersion: string,
  weight: number,
): NamingProfile["modules"][keyof NamingProfile["modules"]] {
  return {
    analysisEnabled: true,
    detailsVisible: true,
    weight,
    schoolId,
    ruleVersion,
  };
}
