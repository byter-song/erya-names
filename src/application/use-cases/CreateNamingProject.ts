import type { ProjectRepository } from "../ports/ProjectRepository";
import { ZodError } from "zod";
import { namingProfileSchema, type NamingProfile } from "../../domain/project/profile";
import { namingProjectSchema } from "../../domain/project/project";
import { err, ok, type Result } from "../../domain/shared/result";

export interface CreateNamingProjectInput {
  profile?: Partial<Omit<NamingProfile, "projectId">>;
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
        stage: input.completeOnboarding ? "generation" : "onboarding",
        status: input.completeOnboarding ? "active" : "draft",
        createdAt: now,
        updatedAt: now,
      });
      const profile = namingProfileSchema.parse({
        projectId,
        surname: input.surname,
        surnameType: input.surnameType,
        givenNameLength: input.givenNameLength,
        requiredCharacters: [],
        generationCharacters: [],
        avoidCharacters: [],
        relativeNames: [],
        forbiddenCombinations: [],
        genderExpression: "unrestricted",
        styleTags: [],
        writingComplexity: "balanced",
        pinyinFriendly: false,
        folklore: { enabled: false, usefulElements: [], includeInRanking: false },
        ...input.profile,
      });

      await this.repository.create({ project, profile });
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
