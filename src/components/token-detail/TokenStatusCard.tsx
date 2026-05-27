import { ThemedText, useThemeColor } from "@/components/Themed";
import { theme } from "@/theme";
import { SymbolView } from "expo-symbols";
import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

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
  const backgroundColor = useThemeColor(
    tone === "danger"
      ? { light: "rgba(220, 53, 69, 0.10)", dark: "rgba(220, 53, 69, 0.18)" }
      : theme.color.backgroundSecondary,
  );
  const borderColor = useThemeColor(
    tone === "danger" ? theme.color.errorBar : theme.color.border,
  );
  const iconColor = useThemeColor(
    tone === "danger" ? theme.color.errorBar : theme.color.textSecondary,
  );

  return (
    <View style={[styles.statusCard, { backgroundColor, borderColor }]}>
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
        <ThemedText fontSize={theme.fontSize16} fontWeight="bold">
          {title}
        </ThemedText>
      </View>
      <ThemedText
        color={tone === "danger" ? theme.color.text : theme.color.textSecondary}
        fontSize={theme.fontSize14}
        style={styles.statusDescription}
      >
        {description}
      </ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  statusCard: {
    borderRadius: theme.borderRadius20,
    borderWidth: 1,
    padding: theme.space16,
  },
  statusDescription: {
    lineHeight: 20,
    marginTop: theme.space8,
  },
  statusTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.space8,
  },
});
