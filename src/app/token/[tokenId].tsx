import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing, Typography } from "@/constants/theme";
import { useToken } from "@/hooks/use-token";
import { useTheme } from "@/hooks/use-theme";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { Platform, StyleSheet, useColorScheme, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function TokenDetails() {
  const params = useLocalSearchParams();
  const { tokens } = useToken();
  const token = tokens.find((t) => t.id === params.tokenId);
  const router = useRouter();
  const colorScheme = useColorScheme() || "light";
  const theme = useTheme();
  const transparentColor = theme.transparent;
  const tabBarBackgroundColor = theme.background;
  const headerStyle = useMemo(
    () => ({
      backgroundColor:
        Platform.OS === "ios" ? transparentColor : tabBarBackgroundColor,
    }),
    [tabBarBackgroundColor, transparentColor],
  );

  return (
    <>
      <Stack.Header
        blurEffect={
          isLiquidGlassAvailable()
            ? undefined
            : colorScheme === "dark"
              ? "dark"
              : "light"
        }
        style={headerStyle}
      ></Stack.Header>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button icon="xmark" onPress={() => router.back()} />
      </Stack.Toolbar>
      <ThemedView
        style={styles.sheet}
        type={isLiquidGlassAvailable() ? "transparent" : "background"}
      >
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <ThemedText fontSize={Typography.fontSize18} fontWeight="bold">
              {token?.label}
            </ThemedText>
            {token?.issuer ? (
              <ThemedText
                fontSize={Typography.fontSize14}
                fontWeight="medium"
                themeColor="textSecondary"
              >
                {token.issuer}
              </ThemedText>
            ) : null}
          </View>
        </SafeAreaView>
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    alignContent: "center",
    flex: 1,
    justifyContent: "center",
    marginTop: Platform.select({ ios: 0, android: 30 }),
    paddingHorizontal: Spacing.xl,
  },
  header: {
    alignItems: "center",
  },
  sheet: {
    flex: 1,
  },
});
