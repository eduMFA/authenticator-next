import { ThemeColor } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  Pressable,
  PressableProps,
  PressableStateCallbackType,
} from "react-native";
import Animated from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ThemedPressableProps = {
  animated?: boolean;
  type?: ThemeColor;
} & PressableProps;

export function ThemedPressable({
  animated,
  style,
  type = "background",
  ...rest
}: ThemedPressableProps) {
  const theme = useTheme();
  const themedStyle =
    typeof style === "function"
      ? (state: PressableStateCallbackType) => [
          { backgroundColor: theme[type] },
          style(state),
        ]
      : [{ backgroundColor: theme[type] }, style];

  if (animated) {
    return <AnimatedPressable style={themedStyle} {...rest} />;
  }

  return <Pressable style={themedStyle} {...rest} />;
}
