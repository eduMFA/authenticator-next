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

export const theme = {
  colorWhite: "#FFFFFF",
  colorBlack: "#000000",
  colorGrey: "#ADB5BD",
  color: {
    branding: { light: "#0066FF", dark: "#3399FF" },
    transparent: {
      light: "rgba(255,255,255,0)",
      dark: "rgba(0,0,0,0)",
    },
    background: { light: "#FFFFFF", dark: "#000000" },
    backgroundSecondary: {
      light: "#f1f1f1",
      dark: "#242424",
    },
    text: { light: "#121212", dark: "#FFFFFF" },
    textSecondary: { light: "#606060", dark: "#CCCCCC" },
    border: { light: "#D9D9D0", dark: "#363A3F" },
    successBar: { light: "rgba(6, 64, 43, 0.6)", dark: "rgba(6, 64, 43, 0.6)" },
    errorBar: {
      light: "rgba(220, 53, 69, 0.6)",
      dark: "rgba(220, 53, 69, 0.6)",
    },
  },

  space2: spaceScale(2),
  space4: spaceScale(4),
  space8: spaceScale(8),
  space12: spaceScale(12),
  space16: spaceScale(16),
  space24: spaceScale(24),

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

  borderRadius4: 4,
  borderRadius6: 6,
  borderRadius10: 10,
  borderRadius12: 12,
  borderRadius20: 20,
  borderRadius32: 32,
  borderRadius34: 34,
  borderRadius40: 40,
  borderRadius45: 45,
  borderRadius80: 80,
};
