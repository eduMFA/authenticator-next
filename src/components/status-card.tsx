import { ThemedText } from "@/components/themed-text";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { SymbolView } from "expo-symbols";
import type { ComponentProps, ReactNode } from "react";
import { ColorValue, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";

type IconName = ComponentProps<typeof SymbolView>["name"];

export type StatusCardVariant = "error" | "danger" | "neutral" | "success";

const variantIcons: Record<StatusCardVariant, IconName> = {
  danger: {
    ios: "exclamationmark.triangle.fill",
    android: "warning",
  },
  error: {
    ios: "xmark.octagon.fill",
    android: "error",
  },
  neutral: {
    ios: "info.circle.fill",
    android: "info",
  },
  success: {
    ios: "checkmark.circle.fill",
    android: "check_circle",
  },
};

type StatusCardProps = {
  variant: StatusCardVariant;
  title: string;
  description: string;
  children?: ReactNode;
  icon?: IconName;
  iconPlacement?: "title" | "side";
  compact?: boolean;
};

export function StatusCard({
  variant,
  title,
  description,
  children,
  icon = variantIcons[variant],
  iconPlacement = "title",
  compact = false,
}: StatusCardProps) {
  const theme = useTheme();
  const colors = getVariantColors(variant, theme);
  const iconElement = (
    <SymbolView
      name={icon}
      size={compact ? 16 : 18}
      tintColor={colors.accent}
    />
  );

  return (
    <Animated.View
      entering={FadeIn.duration(160).easing(Easing.out(Easing.cubic))}
      exiting={FadeOut.duration(120).easing(Easing.in(Easing.cubic))}
      layout={LinearTransition.duration(180).easing(Easing.out(Easing.cubic))}
      style={[
        styles.statusCard,
        compact && styles.statusCardCompact,
        {
          backgroundColor: colors.background,
          borderColor: colors.accent,
        },
      ]}
    >
      <View
        style={[
          styles.statusContentRow,
          compact && styles.statusContentRowCompact,
        ]}
      >
        <View style={styles.statusText}>
          <View style={styles.statusTitleRow}>
            {iconPlacement === "title" ? iconElement : null}
            <ThemedText
              fontSize={compact ? Typography.fontSize14 : Typography.fontSize16}
              fontWeight="bold"
              style={styles.statusTitle}
            >
              {title}
            </ThemedText>
          </View>
          <ThemedText
            fontSize={compact ? Typography.fontSize12 : Typography.fontSize14}
            style={[
              styles.statusDescription,
              compact && styles.statusDescriptionCompact,
            ]}
          >
            {description}
          </ThemedText>
          {children}
        </View>
        {iconPlacement === "side" ? (
          <View
            style={[
              styles.statusSideIcon,
              compact && styles.statusSideIconCompact,
              { borderColor: colors.accent },
            ]}
          >
            {iconElement}
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

function getVariantColors(
  variant: StatusCardVariant,
  theme: ReturnType<typeof useTheme>,
): { accent: ColorValue; background: ColorValue } {
  switch (variant) {
    case "danger":
      return {
        accent: theme.dangerBar,
        background: theme.dangerBackground,
      };
    case "error":
      return {
        accent: theme.errorBar,
        background: theme.errorBackground,
      };
    case "neutral":
      return {
        accent: theme.border,
        background: theme.backgroundSecondary,
      };
    case "success":
      return {
        accent: theme.successBar,
        background: theme.successBackground,
      };
  }
}

const styles = StyleSheet.create({
  statusCard: {
    borderRadius: Radii.xl,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  statusCardCompact: {
    padding: Spacing.md,
  },
  statusContentRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.lg,
  },
  statusContentRowCompact: {
    gap: Spacing.md,
  },
  statusDescription: {
    lineHeight: 20,
    marginTop: Spacing.sm,
  },
  statusDescriptionCompact: {
    lineHeight: Typography.fontSize12 * 1.4,
    marginTop: Spacing.xs,
  },
  statusSideIcon: {
    alignItems: "center",
    borderCurve: "continuous",
    borderRadius: Radii.xl,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  statusSideIconCompact: {
    height: 36,
    width: 36,
  },
  statusText: {
    flex: 1,
    minWidth: 0,
  },
  statusTitle: {
    flexShrink: 1,
  },
  statusTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.sm,
  },
});
