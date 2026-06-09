import { useFonts } from "@expo-google-fonts/inter/";
import { Inter_300Light } from "@expo-google-fonts/inter/300Light";
import { Inter_300Light_Italic } from "@expo-google-fonts/inter/300Light_Italic";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_500Medium_Italic } from "@expo-google-fonts/inter/500Medium_Italic";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_600SemiBold_Italic } from "@expo-google-fonts/inter/600SemiBold_Italic";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { Inter_700Bold_Italic } from "@expo-google-fonts/inter/700Bold_Italic";
import * as Device from "expo-device";
import { Color } from "expo-router";
import { ColorValue, Platform } from "react-native";

const SPACE_SCALE = 1.33;
const FONT_SCALE = 1.2;

const isIpad = Device.osName === "iPadOS";
export const spaceScale = (value: number) =>
  isIpad ? Math.round(value * SPACE_SCALE) : value;
const fontScale = (size: number) =>
  isIpad ? Math.round(size * FONT_SCALE) : size;

export function useInterFonts() {
  return useFonts({
    Inter_300Light,
    Inter_300Light_Italic,
    Inter_500Medium,
    Inter_500Medium_Italic,
    Inter_600SemiBold,
    Inter_600SemiBold_Italic,
    Inter_700Bold,
    Inter_700Bold_Italic,
  });
}

type ThemeColors = {
  branding: ColorValue;
  transparent: ColorValue;
  background: ColorValue;
  backgroundSecondary: ColorValue;
  text: ColorValue;
  textSecondary: ColorValue;
  border: ColorValue;
  fill: ColorValue;
  errorBackground: ColorValue;
  successBar: string;
  errorBar: string;
};

const fallbackColors = {
  light: {
    branding: "#0066FF",
    transparent: "rgba(255,255,255,0)",
    background: "#FFFFFF",
    backgroundSecondary: "#f1f1f1",
    text: "#121212",
    textSecondary: "#606060",
    border: "#D9D9D0",
    fill: "#E5E5EA",
    errorBackground: "rgba(220, 53, 69, 0.10)",
    successBar: "rgba(6, 64, 43, 0.6)",
    errorBar: "rgba(220, 53, 69, 0.6)",
  },
  dark: {
    branding: "#3399FF",
    transparent: "rgba(0,0,0,0)",
    background: "#000000",
    backgroundSecondary: "#242424",
    text: "#FFFFFF",
    textSecondary: "#CCCCCC",
    border: "#363A3F",
    fill: "#2C2C2E",
    errorBackground: "rgba(220, 53, 69, 0.18)",
    successBar: "rgba(6, 64, 43, 0.6)",
    errorBar: "rgba(220, 53, 69, 0.6)",
  },
} as const satisfies Record<"light" | "dark", ThemeColors>;

const iosColors = Color.ios;

const iosThemeColors =
  Platform.OS === "ios" && iosColors
    ? ({
        branding: iosColors.systemBlue,
        transparent: "transparent",
        background: iosColors.systemGroupedBackground,
        backgroundSecondary: iosColors.secondarySystemGroupedBackground,
        text: iosColors.label,
        textSecondary: iosColors.secondaryLabel,
        border: iosColors.separator,
        fill: iosColors.secondarySystemFill,
        errorBackground: fallbackColors.light.errorBackground,
        successBar: fallbackColors.light.successBar,
        errorBar: fallbackColors.light.errorBar,
      } satisfies ThemeColors)
    : null;

export const Colors = {
  light: iosThemeColors ?? fallbackColors.light,
  dark: iosThemeColors ?? fallbackColors.dark,
} as const satisfies Record<"light" | "dark", ThemeColors>;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui",
    serif: "serif",
    rounded: "system-ui",
    mono: "monospace",
  },
});

export const Spacing = {
  xxs: spaceScale(2),
  xs: spaceScale(4),
  sm: spaceScale(8),
  md: spaceScale(12),
  lg: spaceScale(16),
  xl: spaceScale(24),
} as const;

export const Typography = {
  fontSize10: fontScale(10),
  fontSize12: fontScale(12),
  fontSize14: fontScale(14),
  fontSize16: fontScale(16),
  fontSize18: fontScale(18),
  fontSize20: fontScale(20),
  fontSize24: fontScale(24),
  fontSize28: fontScale(28),
  fontSize32: fontScale(32),
  fontSize34: fontScale(34),
  fontSize42: fontScale(42),
  fontFamilyLight: "Inter_300Light",
  fontFamilyLightItalic: "Inter_300Light_Italic",
  fontFamily: "Inter_500Medium",
  fontFamilyItalic: "Inter_500Medium_Italic",
  fontFamilySemiBold: "Inter_600SemiBold",
  fontFamilySemiBoldItalic: "Inter_600SemiBold_Italic",
  fontFamilyBold: "Inter_700Bold",
  fontFamilyBoldItalic: "Inter_700Bold_Italic",
} as const;

export const Radii = {
  sm: 4,
  md: 10,
  lg: 12,
  xl: 20,
  pill: 32,
} as const;

export const StaticColors = {
  white: "#FFFFFF",
  black: "#000000",
  grey: "#ADB5BD",
} as const;
