import { ThemeColor } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { View, ViewProps as RNViewProps } from "react-native";
import Animated from "react-native-reanimated";

export type ThemedViewProps = {
  animated?: boolean;
  type?: ThemeColor;
} & RNViewProps;

export function ThemedView({
  animated,
  style,
  type = "background",
  ...rest
}: ThemedViewProps) {
  const theme = useTheme();
  const viewStyle = [{ backgroundColor: theme[type] }, style];

  if (animated) {
    return <Animated.View style={viewStyle} {...rest} />;
  }

  return <View style={viewStyle} {...rest} />;
}
