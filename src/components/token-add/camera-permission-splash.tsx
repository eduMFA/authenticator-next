import { ThemedText } from "@/components/themed-text";
import { Spacing, Typography } from "@/constants/theme";
import { Button, Host, Text } from "@expo/ui";
import { height as composeHeight } from "@expo/ui/jetpack-compose/modifiers";
import { buttonStyle, controlSize } from "@expo/ui/swift-ui/modifiers";
import { Trans, useLingui } from "@lingui/react/macro";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Platform, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
    <SafeAreaView style={styles.permissionSplash}>
      <View style={styles.permissionIcon}>
        <QRCodeViewfinderIcon size="large" />
      </View>
      <ThemedText
        fontWeight="bold"
        fontSize={Typography.fontSize28}
        style={styles.permissionTitle}
      >
        <Trans>Allow camera access</Trans>
      </ThemedText>
      <ThemedText
        fontWeight="light"
        fontSize={Typography.fontSize16}
        style={styles.permissionText}
      >
        <Trans>
          Camera access is required to scan the QR code and pair a token.
        </Trans>
      </ThemedText>
      <View style={styles.permissionButtonWrapper}>
        <Host matchContents={{ vertical: true }}>
          <Button
            onPress={onContinue}
            disabled={disabled}
            modifiers={[
              controlSize("large"),
              buttonStyle(
                isLiquidGlassAvailable()
                  ? "glassProminent"
                  : "borderedProminent",
              ),
              composeHeight(52),
            ]}
          >
            <Text numberOfLines={1} textStyle={ANDROID_TEXT_STYLE}>
              {t`Continue`}
            </Text>
          </Button>
        </Host>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  permissionButtonWrapper: {
    width: 240,
  },
  permissionIcon: {
    marginBottom: Spacing.xl,
  },
  permissionSplash: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  permissionText: {
    marginBottom: Spacing.xl,
    maxWidth: 320,
    textAlign: "center",
  },
  permissionTitle: {
    marginBottom: Spacing.md,
    textAlign: "center",
  },
});
