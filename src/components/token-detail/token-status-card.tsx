import { ThemedText } from "@/components/themed-text";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { SymbolView } from "expo-symbols";
import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";

export function TokenStatusCard({
  tone,
  title,
  description,
  children,
}: {
  tone: "warning" | "danger" | "neutral";
  title: string;
  description: string;
  children?: ReactNode;
}) {
  const theme = useTheme();
  const isDanger = tone === "danger";
  const backgroundColor = isDanger
    ? theme.errorBackground
    : theme.backgroundSecondary;
  const borderColor = isDanger ? theme.errorBar : theme.border;
  const iconColor = isDanger ? theme.errorBar : theme.textSecondary;

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
      style={[styles.statusCard, { backgroundColor, borderColor }]}
    >
      <View style={styles.statusTitleRow}>
        {tone === "danger" ? (
          <SymbolView
            name={{
              ios: "exclamationmark.triangle.fill",
              android: "warning",
            }}
            size={18}
            tintColor={iconColor}
          />
        ) : null}
        <ThemedText fontSize={Typography.fontSize16} fontWeight="bold">
          {title}
        </ThemedText>
      </View>
      <ThemedText
        themeColor={isDanger ? "text" : "textSecondary"}
        fontSize={Typography.fontSize14}
        style={styles.statusDescription}
      >
        {description}
      </ThemedText>
      {children}
    </Animated.View>
  );
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
