import { SymbolView } from "expo-symbols";
import type { ComponentProps } from "react";
import type { OnboardingStepAccent } from "@/constants/onboarding";

export type IconName = ComponentProps<typeof SymbolView>["name"];

export type OnboardingStep = {
  accent: OnboardingStepAccent;
  body: string;
  id: "welcome" | "notifications" | "privacy";
  kicker: string;
  title: string;
};

export type EasingFunction = (value: number) => number;
