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
  maxFontSizeMultiplier?: number;
  scale?: number;
};

export function StatusCard({
  variant,
  title,
  description,
  children,
  icon = variantIcons[variant],
  iconPlacement = "title",
  maxFontSizeMultiplier,
  scale = 1,
}: StatusCardProps) {
  const theme = useTheme();
  const colors = getVariantColors(variant, theme);
  const iconElement = (
    <SymbolView name={icon} size={18 * scale} tintColor={colors.accent} />
  );

  return (
    <Animated.View
      entering={FadeIn.duration(160).easing(Easing.out(Easing.cubic))}
      exiting={FadeOut.duration(120).easing(Easing.in(Easing.cubic))}
      layout={LinearTransition.duration(180).easing(Easing.out(Easing.cubic))}
      style={[
        styles.statusCard,
        {
          backgroundColor: colors.background,
          borderColor: colors.accent,
          padding: Spacing.lg * scale,
        },
      ]}
    >
      <View style={[styles.statusContentRow, { gap: Spacing.lg * scale }]}>
        <View style={styles.statusText}>
          <View style={styles.statusTitleRow}>
            {iconPlacement === "title" ? iconElement : null}
            <ThemedText
              fontSize={Typography.fontSize16 * scale}
              fontWeight="bold"
              maxFontSizeMultiplier={maxFontSizeMultiplier}
              style={styles.statusTitle}
            >
              {title}
            </ThemedText>
          </View>
          <ThemedText
            fontSize={Typography.fontSize14 * scale}
            maxFontSizeMultiplier={maxFontSizeMultiplier}
            style={[
              styles.statusDescription,
              {
                lineHeight: Typography.fontSize14 * scale * 1.4,
                marginTop: Spacing.sm * scale,
              },
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
              {
                borderColor: colors.accent,
                height: 42 * scale,
                width: 42 * scale,
              },
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
  statusContentRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.lg,
  },
  statusDescription: {
    lineHeight: 20,
    marginTop: Spacing.sm,
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
