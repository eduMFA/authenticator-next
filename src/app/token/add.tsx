import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { CameraPermissionSplash } from "@/components/token-add/camera-permission-splash";
import QRCodeScanner from "@/components/token-add/qr-code-scanner";
import { UploadQRCodeButton } from "@/components/token-add/upload-qr-code-button";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { useHandleTokenUri } from "@/hooks/use-handle-token-uri";
import { useTheme } from "@/hooks/use-theme";
import ArrowBackSymbol from "@expo/material-symbols/arrow_back.xml";
import { Trans } from "@lingui/react/macro";
import * as Camera from "expo-camera";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Stack, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { AppState, Platform, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AddToken() {
  const router = useRouter();
  const handleTokenUri = useHandleTokenUri();
  const [permission, requestPermission, getPermission] =
    Camera.useCameraPermissions({});
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const theme = useTheme();
  const borderColor = theme.border;
  const transparentColor = theme.transparent;
  const tabBarBackgroundColor = theme.background;
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

  const handleRequestPermission = async () => {
    setIsRequestingPermission(true);
    try {
      await requestPermission();
    } finally {
      setIsRequestingPermission(false);
    }
  };

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void getPermission();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [getPermission]);

  const shouldShowPermissionSplash =
    !permission?.granted && (permission?.canAskAgain ?? true);

  const content = shouldShowPermissionSplash ? (
    <CameraPermissionSplash
      disabled={isRequestingPermission}
      onContinue={() => {
        void handleRequestPermission();
      }}
    />
  ) : (
    <SafeAreaView style={styles.container}>
      <View style={styles.header} collapsable={false}>
        <ThemedText
          fontWeight="bold"
          fontSize={Typography.fontSize28}
          style={styles.title}
        >
          <Trans>Pair new Push Token</Trans>
        </ThemedText>
      </View>
      <View style={styles.scanner}>
        <QRCodeScanner
          permission={permission}
          onQRCodeScanned={handleQRCodeScanned}
        />
      </View>
      <View style={styles.splitter}>
        <View style={[styles.splitterLine, { backgroundColor: borderColor }]} />
        <ThemedText
          style={[styles.splitterText, { color: borderColor }]}
          fontWeight="bold"
        >
          <Trans>OR</Trans>
        </ThemedText>
        <View style={[styles.splitterLine, { backgroundColor: borderColor }]} />
      </View>
      <UploadQRCodeButton onQRCodeScanned={handleQRCodeScanned} />
    </SafeAreaView>
  );

  return (
    <>
      <Stack.Header style={headerStyle} />
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
        {content}
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
    marginBottom: Spacing.lg,
  },
  scanner: {
    borderRadius: Radii.xl,
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
    marginHorizontal: Spacing.lg,
  },
  title: {
    textAlign: "center",
  },
});
