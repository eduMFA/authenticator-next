import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { CameraPermissionSplash } from "@/components/token-add/camera-permission-splash";
import QRCodeScanner from "@/components/token-add/qr-code-scanner";
import { UploadQRCodeButton } from "@/components/token-add/upload-qr-code-button";
import {
  getResponsiveScale,
  Radii,
  Spacing,
  Typography,
} from "@/constants/theme";
import { useHandleTokenUri } from "@/hooks/use-handle-token-uri";
import { useTheme } from "@/hooks/use-theme";
import ArrowBackSymbol from "@expo/material-symbols/arrow_back.xml";
import { Trans } from "@lingui/react/macro";
import * as Camera from "expo-camera";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Stack, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  AppState,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

export default function AddToken() {
  const router = useRouter();
  const handleTokenUri = useHandleTokenUri();
  const [permission, requestPermission, getPermission] =
    Camera.useCameraPermissions({});
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const theme = useTheme();
  const { height, width } = useWindowDimensions();
  const { bottom, top } = useSafeAreaInsets();
  const layoutScale = getResponsiveScale(width, height - top - bottom);
  const uploadButtonSize = layoutScale < 0.95 ? "compact" : "expanded";
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
          fontSize={Typography.fontSize28 * layoutScale}
          maxFontSizeMultiplier={1.15}
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
      <View style={[styles.splitter, { gap: Spacing.lg * layoutScale }]}>
        <View style={[styles.splitterLine, { backgroundColor: borderColor }]} />
        <ThemedText
          style={{ color: borderColor }}
          fontSize={Typography.fontSize16 * layoutScale}
          fontWeight="bold"
          maxFontSizeMultiplier={1.15}
        >
          <Trans>OR</Trans>
        </ThemedText>
        <View style={[styles.splitterLine, { backgroundColor: borderColor }]} />
      </View>
      <UploadQRCodeButton
        onQRCodeScanned={handleQRCodeScanned}
        size={uploadButtonSize}
      />
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
    flex: 1,
    gap: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
  },
  header: {},
  scanner: {
    borderRadius: Radii.xl,
    flex: 1,
    minHeight: 200,
    overflow: "hidden",
    width: "100%",
  },
  sheet: {
    flex: 1,
  },
  splitter: {
    alignItems: "center",
    flexDirection: "row",
  },
  splitterLine: {
    flex: 1,
    height: 1,
  },
  title: {
    textAlign: "center",
  },
});
