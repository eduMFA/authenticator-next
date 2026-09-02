import { FeedbackForm } from "@/components/feedback-form";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";
import ArrowBackSymbol from "@expo/material-symbols/arrow_back.xml";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { useLingui } from "@lingui/react/macro";
import { Stack, useRouter } from "expo-router";
import { Platform, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function FeedbackScreen() {
  const router = useRouter();
  const { t } = useLingui();
  const theme = useTheme();
  return (
    <>
      <Stack.Header
        style={{
          backgroundColor:
            Platform.OS === "ios" ? theme.transparent : theme.background,
        }}
      />
      <Stack.Screen.Title>{t`Send feedback`}</Stack.Screen.Title>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon={process.env.EXPO_OS === "ios" ? "xmark" : ArrowBackSymbol}
          onPress={() => router.back()}
        />
      </Stack.Toolbar>
      <ThemedView
        style={styles.sheet}
        type={isLiquidGlassAvailable() ? "transparent" : "background"}
      >
        <SafeAreaView edges={["bottom", "left", "right"]} style={styles.sheet}>
          <FeedbackForm onClose={() => router.back()} />
        </SafeAreaView>
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
});
