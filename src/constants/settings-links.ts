import { Platform } from "react-native";

export const SettingsLinks = {
  github: "https://github.com/eduMFA/authenticator-next",
  privacyPolicy: "https://edumfa.io/app-privacy",
  review:
    Platform.select({
      android: "market://details?id=io.edumfa.app",
      ios: "itms-apps://apps.apple.com/app/io.edumfa.app?action=write-review",
    }) ?? "https://edumfa.io",
  website: "https://edumfa.io",
} as const;
