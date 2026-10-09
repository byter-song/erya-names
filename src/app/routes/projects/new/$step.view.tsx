import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { onboardingRoute } from "./$step";
import { useApplicationContainer } from "../../../providers";
import { OnboardingWizard } from "../../../../features/onboarding/OnboardingWizard";
import type { CompleteOnboardingInput } from "../../../../features/onboarding/projectFormSchema";

export function OnboardingPlaceholder() {
  const container = useApplicationContainer();
  const navigate = useNavigate();
  const { step } = onboardingRoute.useParams();
  const currentStep = wizardSteps.indexOf(step as (typeof wizardSteps)[number]) + 1;

  useEffect(() => {
    if (currentStep === 0)
      void navigate({
        to: "/projects/new/$step",
        params: { step: wizardSteps[0] },
        replace: true,
      });
  }, [currentStep, navigate]);

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
        childGender: input.childGender,
        constraintKnowledge: input.constraintKnowledge,
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

  return (
    <OnboardingWizard
      currentStep={currentStep || 1}
      onComplete={complete}
      onStepChange={(nextStep) =>
        void navigate({
          to: "/projects/new/$step",
          params: { step: wizardSteps[nextStep - 1] ?? wizardSteps[0] },
        })
      }
    />
  );
}

const wizardSteps = ["basic", "constraints", "preferences"] as const;
