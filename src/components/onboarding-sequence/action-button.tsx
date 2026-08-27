import { ThemedText } from "@/components/themed-text";
import { ONBOARDING_MAX_FONT_SIZE_MULTIPLIER } from "@/constants/onboarding";
import { Radii, Spacing, StaticColors, Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { SymbolView } from "expo-symbols";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type ColorValue,
} from "react-native";
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
  scale?: number;
  variant?: "neutral" | "primary" | "secondary";
};

export function ActionButton({
  accentColor,
  icon,
  isLoading = false,
  label,
  onPress,
  scale = 1,
  variant = "primary",
}: ActionButtonProps) {
  const theme = useTheme();
  const isPrimary = variant === "primary";
  const isNeutral = variant === "neutral";
  const foregroundColor: ColorValue = isPrimary
    ? StaticColors.white
    : theme.text;
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
      accessibilityRole="button"
      accessibilityState={{ busy: isLoading, disabled: isLoading }}
      disabled={isLoading}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.actionButton,
        {
          backgroundColor: isPrimary ? accentColor : theme.transparent,
          borderColor: isNeutral ? theme.border : accentColor,
          minHeight: Math.max(44, 56 * scale),
          paddingHorizontal: Spacing.lg * scale,
        },
        isLoading && styles.actionButtonLoading,
        animatedStyle,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator color={foregroundColor} />
      ) : (
        <SymbolView name={icon} size={18 * scale} tintColor={foregroundColor} />
      )}
      <ThemedText
        fontSize={Typography.fontSize16 * scale}
        fontWeight="semiBold"
        maxFontSizeMultiplier={ONBOARDING_MAX_FONT_SIZE_MULTIPLIER}
        style={[
          styles.actionLabel,
          {
            color: foregroundColor,
            lineHeight: Typography.fontSize16 * scale * 1.25,
          },
        ]}
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
  },
  actionButtonLoading: {
    opacity: 0.72,
  },
  actionLabel: {
    textAlign: "center",
  },
});
