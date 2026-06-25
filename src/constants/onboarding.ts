import { Spacing } from "@/constants/theme";

export type OnboardingStepAccent = { light: string; dark: string };

export const ONBOARDING_PANEL_GAP = Spacing.xl * 3;

export const onboardingStepAccents: OnboardingStepAccent[] = [
  { light: "#0066FF", dark: "#58A6FF" },
  { light: "#0F9F6E", dark: "#47D7A0" },
  { light: "#8A5CF6", dark: "#B49AFF" },
];

export const ONBOARDING_STEP_COUNT = onboardingStepAccents.length;
export const onboardingProgressInputRange = onboardingStepAccents.map(
  (_, index) => index,
);
