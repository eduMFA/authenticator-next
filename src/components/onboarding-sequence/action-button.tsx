import { ThemedText } from "@/components/themed-text";
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
  compact?: boolean;
  icon: IconName;
  isLoading?: boolean;
  label: string;
  onPress: () => void;
  variant?: "neutral" | "primary" | "secondary";
};

export function ActionButton({
  accentColor,
  compact = false,
  icon,
  isLoading = false,
  label,
  onPress,
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
        compact && styles.actionButtonCompact,
        {
          backgroundColor: isPrimary ? accentColor : theme.transparent,
          borderColor: isNeutral ? theme.border : accentColor,
        },
        isLoading && styles.actionButtonLoading,
        animatedStyle,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator color={foregroundColor} />
      ) : (
        <SymbolView
          name={icon}
          size={compact ? 16 : 18}
          tintColor={foregroundColor}
        />
      )}
      <ThemedText
        fontSize={compact ? Typography.fontSize14 : Typography.fontSize16}
        fontWeight="semiBold"
        style={[
          styles.actionLabel,
          compact && styles.actionLabelCompact,
          { color: foregroundColor },
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
    minHeight: 56,
    paddingHorizontal: Spacing.lg,
  },
  actionButtonCompact: {
    minHeight: 48,
    paddingHorizontal: Spacing.md,
  },
  actionButtonLoading: {
    opacity: 0.72,
  },
  actionLabel: {
    lineHeight: Typography.fontSize16 * 1.25,
    textAlign: "center",
  },
  actionLabelCompact: {
    lineHeight: Typography.fontSize14 * 1.25,
  },
});
