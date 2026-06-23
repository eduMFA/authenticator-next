import { ThemedText } from "@/components/themed-text";
import { Radii, Spacing, StaticColors, Typography } from "@/constants/theme";
import { SymbolView } from "expo-symbols";
import { ActivityIndicator, Pressable, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { IconName } from "@/types/onboarding";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ActionButtonProps = {
  accentColor: string;
  icon: IconName;
  isLoading?: boolean;
  label: string;
  onPress: () => void;
};

export function ActionButton({
  accentColor,
  icon,
  isLoading = false,
  label,
  onPress,
}: ActionButtonProps) {
  const pressScale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));
  const handlePressIn = () => {
    pressScale.set(withTiming(0.98, { duration: 90 }));
  };
  const handlePressOut = () => {
    pressScale.set(withTiming(1, { duration: 120 }));
  };

  return (
    <AnimatedPressable
      disabled={isLoading}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.actionButton,
        { backgroundColor: accentColor, borderColor: accentColor },
        isLoading && styles.actionButtonLoading,
        animatedStyle,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator color={StaticColors.white} />
      ) : (
        <SymbolView name={icon} size={18} tintColor={StaticColors.white} />
      )}
      <ThemedText
        fontSize={Typography.fontSize16}
        fontWeight="semiBold"
        style={[styles.actionLabel, { color: StaticColors.white }]}
      >
        {label}
      </ThemedText>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: "center",
    borderCurve: "continuous",
    borderRadius: Radii.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: Spacing.sm,
    justifyContent: "center",
    minHeight: 56,
    paddingHorizontal: Spacing.lg,
  },
  actionButtonLoading: {
    opacity: 0.72,
  },
  actionLabel: {
    lineHeight: Typography.fontSize16 * 1.25,
    textAlign: "center",
  },
});
