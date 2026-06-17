import { ThemedText } from "@/components/themed-text";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { SymbolView } from "expo-symbols";
import { ReactNode } from "react";
import { ColorValue, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";

export type StatusCardVariant = "error" | "danger" | "success";

const variantIcons = {
  danger: {
    ios: "exclamationmark.triangle.fill",
    android: "warning",
  },
  error: {
    ios: "xmark.octagon.fill",
    android: "error",
  },
  success: {
    ios: "checkmark.circle.fill",
    android: "check_circle",
  },
} as const;

export function StatusCard({
  variant,
  title,
  description,
  children,
}: {
  variant: StatusCardVariant;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  const theme = useTheme();
  const colors = getVariantColors(variant, theme);

  return (
    <Animated.View
      entering={FadeIn.duration(160)
        .easing(Easing.out(Easing.cubic))
        .withInitialValues({
          opacity: 0,
          transform: [{ scale: 0.985 }],
        })}
      exiting={FadeOut.duration(120).easing(Easing.in(Easing.cubic))}
      layout={LinearTransition.duration(180).easing(Easing.out(Easing.cubic))}
      style={[
        styles.statusCard,
        {
          backgroundColor: colors.background,
          borderColor: colors.accent,
        },
      ]}
    >
      <View style={styles.statusTitleRow}>
        <SymbolView
          name={variantIcons[variant]}
          size={18}
          tintColor={colors.accent}
        />
        <ThemedText fontSize={Typography.fontSize16} fontWeight="bold">
          {title}
        </ThemedText>
      </View>
      <ThemedText
        fontSize={Typography.fontSize14}
        style={styles.statusDescription}
      >
        {description}
      </ThemedText>
      {children}
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
  statusDescription: {
    lineHeight: 20,
    marginTop: Spacing.sm,
  },
  statusTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.sm,
  },
});
