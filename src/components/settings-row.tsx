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
  const iconView = (
    <SymbolView name={icon} size={22} tintColor={theme.textSecondary} />
  );
  const content = (
    <>
      {process.env.EXPO_OS === "ios" ? (
        <View
          style={[
            styles.iosIconContainer,
            {
              backgroundColor: theme.fill,
              borderColor: theme.border,
            },
          ]}
        >
          {iconView}
        </View>
      ) : (
        iconView
      )}
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
  iosIconContainer: {
    alignItems: "center",
    borderCurve: "continuous",
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.16)",
    height: 32,
    justifyContent: "center",
    width: 32,
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
