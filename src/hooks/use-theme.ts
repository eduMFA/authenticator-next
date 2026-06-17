import { Colors, getAndroidThemeColors } from "@/constants/theme";
import { Platform, useColorScheme } from "react-native";

export function useTheme() {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? "dark" : "light";

  if (Platform.OS === "android") {
    return getAndroidThemeColors() ?? Colors[theme];
  }

  return Colors[theme];
}
