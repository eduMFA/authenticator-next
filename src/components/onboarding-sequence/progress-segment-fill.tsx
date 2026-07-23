import { Radii } from "@/constants/theme";
import { StyleSheet } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";

type ProgressSegmentFillProps = {
  index: number;
  inputRange: number[];
  progress: SharedValue<number>;
  stepAccentColors: string[];
};

export function ProgressSegmentFill({
  index,
  inputRange,
  progress,
  stepAccentColors,
}: ProgressSegmentFillProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const fillProgress = interpolate(
      progress.value,
      [index - 1, index],
      [0, 1],
      Extrapolation.CLAMP,
    );

    return {
      backgroundColor: interpolateColor(
        progress.value,
        inputRange,
        stepAccentColors,
      ),
      width: `${fillProgress * 100}%`,
    };
  });

  return <Animated.View style={[styles.progressFill, animatedStyle]} />;
}

const styles = StyleSheet.create({
  progressFill: {
    borderRadius: Radii.sm,
    height: 4,
  },
});
