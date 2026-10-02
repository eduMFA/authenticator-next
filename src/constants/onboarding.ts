import { BRAND_COLOR, Spacing } from "@/constants/theme";

export type OnboardingStepAccent = { light: string; dark: string };

export const ONBOARDING_PANEL_GAP = Spacing.xl * 3;
export const ONBOARDING_MAX_FONT_SIZE_MULTIPLIER = 1.15;

export const onboardingStepAccents: OnboardingStepAccent[] = [
  { light: BRAND_COLOR, dark: BRAND_COLOR },
  { light: "#087F8C", dark: "#087F8C" },
  { light: "#6952C7", dark: "#6952C7" },
];

export const ONBOARDING_STEP_COUNT = onboardingStepAccents.length;
export const onboardingProgressInputRange = onboardingStepAccents.map(
  (_, index) => index,
);
