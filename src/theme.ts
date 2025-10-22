import * as Device from "expo-device";

const SPACE_SCALE = 1.33;
const FONT_SCALE = 1.2;

const isIpad = Device.osName === "iPadOS";
export const spaceScale = (value: number) =>
  isIpad ? Math.round(value * SPACE_SCALE) : value;
const fontScale = (size: number) =>
  isIpad ? Math.round(size * FONT_SCALE) : size;

export const theme = {
  colorWhite: "#FFFFFF",
  colorBlack: "#000000",
  color: {
    branding: { light: "#0066FF", dark: "#3399FF" },
    background: { light: "#FFFFFF", dark: "#000000" },
    text: { light: "#121212", dark: "#FFFFFF" },
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

  fontFamilyLight: "Montserrat-Light",
  fontFamilyLightItalic: "Montserrat-LightItalic",

  fontFamily: "Montserrat-Medium",
  fontFamilyItalic: "Montserrat-MediumItalic",

  fontFamilySemiBold: "Montserrat-SemiBold",
  fontFamilySemiBoldItalic: "Montserrat-SemiBoldItalic",

  fontFamilyBold: "Montserrat-Bold",
  fontFamilyBoldItalic: "Montserrat-BoldItalic",
};
