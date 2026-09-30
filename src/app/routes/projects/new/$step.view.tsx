import { useNavigate } from "@tanstack/react-router";
import { useApplicationContainer } from "../../../providers";
import { OnboardingWizard } from "../../../../features/onboarding/OnboardingWizard";
import type { CompleteOnboardingInput } from "../../../../features/onboarding/projectFormSchema";

export function OnboardingPlaceholder() {
  const container = useApplicationContainer();
  const navigate = useNavigate();

  const complete = async (input: CompleteOnboardingInput) => {
    if (!container.createNamingProject || !container.updateNamingProfile) {
      throw new Error("项目服务未就绪");
    }

    const created = await container.createNamingProject.execute({
      title: input.title,
      surname: input.surname,
      surnameType: input.surnameType,
      givenNameLength: input.givenNameLength,
      completeOnboarding: true,
      profile: {
        requiredCharacters: input.requiredCharacters.map((char) => ({ char, position: "any" })),
        avoidCharacters: input.avoidCharacters,
        relativeNames: input.relativeNames,
        styleTags: input.styleTags,
        genderExpression: input.genderExpression,
        writingComplexity: input.writingComplexity,
        pinyinFriendly: input.pinyinFriendly,
        folklore: input.folklore,
      },
    });
    if (!created.ok) throw new Error(created.error);

    await navigate({
      to: "/projects/$projectId/generate",
      params: { projectId: created.value.projectId },
    });
  };

  return <OnboardingWizard onComplete={complete} />;
}
