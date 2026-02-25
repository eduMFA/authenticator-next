import QRCodeScanner from "@/components/QRCodeScanner";
import { ThemedText, ThemedView, useThemeColor } from "@/components/Themed";
import { UploadQRCodeButton } from "@/components/UploadQRCodeButton";
import { useHandleTokenUri } from "@/hooks/useHandleTokenUri";
import { theme } from "@/theme";
import { Trans } from "@lingui/react/macro";
import * as Camera from "expo-camera";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Stack, useRouter } from "expo-router";
import { useMemo } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AddToken() {
  const router = useRouter();
  const handleTokenUri = useHandleTokenUri();
  const borderColor = useThemeColor(theme.color.border);
  const transparentColor = useThemeColor(theme.color.transparent);
  const tabBarBackgroundColor = useThemeColor(theme.color.background);
  const headerStyle = useMemo(
    () => ({
      backgroundColor:
        Platform.OS === "ios" ? transparentColor : tabBarBackgroundColor,
    }),
    [tabBarBackgroundColor, transparentColor],
  );

  const handleQRCodeScanned = async (
    result: Camera.BarcodeScanningResult | null,
  ) => {
    router.back();
    const uri = result?.data ?? null;
    void handleTokenUri(uri);
  };

  return (
    <>
      <Stack.Header style={headerStyle} />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button icon="xmark" onPress={() => router.back()} />
      </Stack.Toolbar>
      <ThemedView
        style={styles.sheet}
        color={
          isLiquidGlassAvailable()
            ? theme.color.transparent
            : theme.color.background
        }
      >
        <SafeAreaView style={styles.container}>
          <View style={styles.header} collapsable={false}>
            <ThemedText
              fontWeight="bold"
              fontSize={theme.fontSize28}
              style={styles.title}
            >
              <Trans>Pair new Push Token</Trans>
            </ThemedText>
            <ThemedText
              fontWeight="light"
              fontSize={theme.fontSize16}
              style={styles.subtitle}
            >
              <Trans>Scan the QR code to pair a new push token.</Trans>
            </ThemedText>
          </View>
          <View style={styles.scanner}>
            <QRCodeScanner onQRCodeScanned={handleQRCodeScanned} />
          </View>
          <View style={styles.splitter}>
            <View
              style={[styles.splitterLine, { backgroundColor: borderColor }]}
            />
            <ThemedText
              style={[styles.splitterText, { color: borderColor }]}
              fontWeight="bold"
            >
              <Trans>OR</Trans>
            </ThemedText>
            <View
              style={[styles.splitterLine, { backgroundColor: borderColor }]}
            />
          </View>
          <UploadQRCodeButton onQRCodeScanned={handleQRCodeScanned} />
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
    paddingHorizontal: theme.space24,
  },
  header: {
    marginBottom: theme.space24,
  },
  scanner: {
    borderRadius: theme.borderRadius20,
    height: 300,
    overflow: "hidden",
    width: "100%",
  },
  sheet: {
    flex: 1,
  },
  splitter: {
    alignItems: "center",
    flexDirection: "row",
    marginVertical: 16,
  },
  splitterLine: {
    flex: 1,
    height: 1,
  },
  splitterText: {
    marginHorizontal: theme.space16,
  },
  subtitle: {
    textAlign: "center",
  },
  title: {
    marginBottom: theme.space12,
    textAlign: "center",
  },
});
