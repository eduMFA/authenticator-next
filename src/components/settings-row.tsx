import { Radii, Spacing, Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { SymbolView, type AndroidSymbol, type SFSymbol } from "expo-symbols";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ThemedText } from "./themed-text";

type SettingsRowProps = {
  detail?: string;
  icon: { android: AndroidSymbol; ios: SFSymbol };
  label: string;
  onPress?: () => void;
  trailing?: ReactNode;
};

export function SettingsRow({
  detail,
  icon,
  label,
  onPress,
  trailing,
}: SettingsRowProps) {
  const theme = useTheme();
  const content = (
    <>
      <SymbolView name={icon} size={22} tintColor={theme.textSecondary} />
      <View style={styles.copy}>
        <ThemedText fontSize={Typography.fontSize16}>{label}</ThemedText>
        {detail ? (
          <ThemedText
            fontSize={Typography.fontSize12}
            themeColor="textSecondary"
          >
            {detail}
          </ThemedText>
        ) : null}
      </View>
      {trailing ??
        (onPress ? (
          <SymbolView
            name={{ android: "chevron_right", ios: "chevron.right" }}
            size={14}
            tintColor={theme.textSecondary}
          />
        ) : null)}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.row}>{content}</View>;
}

const styles = StyleSheet.create({
  copy: {
    flex: 1,
    gap: Spacing.xxs,
  },
  pressed: {
    opacity: 0.55,
  },
  row: {
    alignItems: "center",
    borderCurve: "continuous",
    borderRadius: Radii.lg,
    flexDirection: "row",
    gap: Spacing.md,
    minHeight: 58,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
});
