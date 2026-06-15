import { ThemeColor, Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { Text, TextProps as RNTextProps, TextStyle } from "react-native";
import Animated from "react-native-reanimated";

export type ThemedTextProps = {
  animated?: boolean;
  fontSize?: TextStyle["fontSize"];
  fontWeight?: "light" | "medium" | "semiBold" | "bold";
  italic?: boolean;
  marginBottom?: number;
  themeColor?: ThemeColor;
} & RNTextProps;

export function ThemedText({
  animated,
  fontSize = Typography.fontSize16,
  fontWeight,
  italic,
  marginBottom = 0,
  style,
  themeColor = "text",
  ...rest
}: ThemedTextProps) {
  const theme = useTheme();
  const fontFamily = (() => {
    if (fontWeight === "light") {
      return italic
        ? Typography.fontFamilyLightItalic
        : Typography.fontFamilyLight;
    }

    if (fontWeight === "semiBold") {
      return italic
        ? Typography.fontFamilySemiBoldItalic
        : Typography.fontFamilySemiBold;
    }

    if (fontWeight === "bold") {
      return italic
        ? Typography.fontFamilyBoldItalic
        : Typography.fontFamilyBold;
    }

    return italic ? Typography.fontFamilyItalic : Typography.fontFamily;
  })();
  const textStyle = [
    {
      color: theme[themeColor],
      fontFamily,
      fontSize,
      marginBottom,
    },
    style,
  ];

  if (animated) {
    return <Animated.Text style={textStyle} {...rest} />;
  }

  return <Text style={textStyle} {...rest} />;
}
