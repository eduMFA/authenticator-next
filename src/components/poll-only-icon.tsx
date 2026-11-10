import { useTheme } from "@/hooks/use-theme";
import { useLingui } from "@lingui/react/macro";
import { SymbolView } from "expo-symbols";
import { StyleSheet, View } from "react-native";

export function PollOnlyIcon() {
  const theme = useTheme();
  const { t } = useLingui();
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t`Poll only`}
      style={styles.icon}
    >
      <SymbolView
        name={{ ios: "arrow.clockwise", android: "refresh" }}
        size={16}
        tintColor={theme.textSecondary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  icon: { flexShrink: 0 },
});
