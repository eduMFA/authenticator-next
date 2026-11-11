import { ThemedText } from "@/components/themed-text";
import { Spacing, StaticColors, Typography } from "@/constants/theme";
import { Button, Host, Text } from "@expo/ui";
import { height as composeHeight } from "@expo/ui/jetpack-compose/modifiers";
import { buttonStyle, controlSize } from "@expo/ui/swift-ui/modifiers";
import { Trans, useLingui } from "@lingui/react/macro";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Platform, StyleSheet, View } from "react-native";
import { QRCodeViewfinderIcon } from "./qr-code-viewfinder-icon";

const ANDROID_TEXT_STYLE = Platform.select({
  android: { fontSize: 18 },
});

export type CameraPermissionSplashProps = {
  disabled: boolean;
  onContinue: () => void;
};

export function CameraPermissionSplash({
  disabled,
  onContinue,
}: CameraPermissionSplashProps) {
  const { t } = useLingui();

  return (
    <View style={styles.permissionSplash}>
      <View style={styles.permissionIcon}>
        <QRCodeViewfinderIcon />
      </View>
      <ThemedText
        fontWeight="bold"
        fontSize={Typography.fontSize18}
        style={styles.permissionTitle}
      >
        <Trans>Allow camera access</Trans>
      </ThemedText>
      <ThemedText
        fontSize={Typography.fontSize14}
        style={styles.permissionText}
      >
        <Trans>Use your camera to scan a QR code.</Trans>
      </ThemedText>
      <View style={styles.permissionButtonWrapper}>
        <Host
          matchContents={{ horizontal: Platform.OS === "ios", vertical: true }}
          style={Platform.OS === "ios" ? styles.centeredButton : undefined}
        >
          <Button
            onPress={onContinue}
            disabled={disabled}
            modifiers={[
              controlSize("large"),
              buttonStyle(isLiquidGlassAvailable() ? "glass" : "bordered"),
              composeHeight(44),
            ]}
          >
            <Text numberOfLines={1} textStyle={ANDROID_TEXT_STYLE}>
              {t`Continue`}
            </Text>
          </Button>
        </Host>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centeredButton: {
    alignSelf: "center",
  },
  permissionButtonWrapper: {
    maxWidth: "100%",
    width: 240,
  },
  permissionIcon: {
    marginBottom: Spacing.md,
  },
  permissionSplash: {
    alignItems: "center",
    backgroundColor: StaticColors.black,
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
  },
  permissionText: {
    color: StaticColors.grey,
    lineHeight: 18,
    marginBottom: Spacing.md,
    maxWidth: 280,
    textAlign: "center",
  },
  permissionTitle: {
    color: StaticColors.white,
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
});
