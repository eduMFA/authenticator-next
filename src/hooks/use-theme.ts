import { Colors } from "@/constants/theme";
import { useSettingsStore } from "@/stores/settings";
import { useColorScheme } from "react-native";

export function useResolvedThemeScheme() {
  const scheme = useColorScheme();
  const themePreference = useSettingsStore((state) => state.themePreference);

  if (themePreference !== "auto") {
    return themePreference;
  }

  return scheme === "dark" ? "dark" : "light";
}

export function useTheme() {
  return Colors[useResolvedThemeScheme()];
}
