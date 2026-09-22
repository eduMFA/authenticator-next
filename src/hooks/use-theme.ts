import {
  Colors,
  getAndroidThemeColors,
  getIosThemeColors,
} from "@/constants/theme";
import { Platform, useColorScheme } from "react-native";

export function useTheme() {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? "dark" : "light";

  if (Platform.OS === "android") {
    return getAndroidThemeColors(theme) ?? Colors[theme];
  }

  if (Platform.OS === "ios") {
    return getIosThemeColors(theme) ?? Colors[theme];
  }

  return Colors[theme];
}
