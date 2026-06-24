import { ThemedText } from "@/components/themed-text";
import { Spacing, StaticColors, Typography } from "@/constants/theme";
import { Button, Host, Row, Spacer, Text } from "@expo/ui";
import { height as composeHeight } from "@expo/ui/jetpack-compose/modifiers";
import { buttonStyle, controlSize } from "@expo/ui/swift-ui/modifiers";
import { Trans, useLingui } from "@lingui/react/macro";
import { isLiquidGlassAvailable } from "expo-glass-effect/build/isLiquidGlassAvailable";
import { Platform, StyleSheet, View } from "react-native";
import { QRCodeViewfinderIcon } from "./qr-code-viewfinder-icon";

const ANDROID_TEXT_STYLE = Platform.select({
  android: { fontSize: 18 },
});

export type CameraPermissionDeniedProps = {
  onOpenSettings: () => void;
};

export function CameraPermissionDenied({
  onOpenSettings,
}: CameraPermissionDeniedProps) {
  const { t } = useLingui();

  return (
    <View style={styles.permissionContainer}>
      <View style={styles.permissionIcon}>
        <QRCodeViewfinderIcon />
      </View>
      <ThemedText
        style={styles.permissionText}
        fontWeight="bold"
        fontSize={Typography.fontSize18}
      >
        <Trans>Camera access is turned off</Trans>
      </ThemedText>
      <ThemedText
        style={styles.permissionBody}
        fontSize={Typography.fontSize14}
      >
        <Trans>Enable camera access in Settings to scan QR codes.</Trans>
      </ThemedText>
      <View style={styles.permissionButtonWrapper}>
        <Host matchContents={{ vertical: true }}>
          <Button
            onPress={onOpenSettings}
            modifiers={[
              controlSize("large"),
              buttonStyle(isLiquidGlassAvailable() ? "glass" : "bordered"),
              composeHeight(44),
            ]}
          >
            <Row alignment="center" spacing={6}>
              <Spacer flexible />
              <Text numberOfLines={1} textStyle={ANDROID_TEXT_STYLE}>
                {t`Open Settings`}
              </Text>
              <Spacer flexible />
            </Row>
          </Button>
        </Host>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  permissionBody: {
    color: StaticColors.grey,
    lineHeight: 18,
    marginBottom: Spacing.md,
    maxWidth: 280,
    textAlign: "center",
  },
  permissionButtonWrapper: {
    width: 240,
  },
  permissionContainer: {
    alignItems: "center",
    backgroundColor: StaticColors.black,
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
  },
  permissionIcon: {
    marginBottom: Spacing.md,
  },
  permissionText: {
    color: StaticColors.white,
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
});
