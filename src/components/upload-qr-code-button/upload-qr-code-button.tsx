import { theme } from "@/theme";
import { Trans } from "@lingui/react/macro";
import { Pressable, StyleSheet } from "react-native";
import { ThemedText, useThemeColor } from "../Themed";
import { pickAndScanQRCode, UploadQRCodeButtonProps } from "./shared";

export function UploadQRCodeButton({
  onQRCodeScanned,
}: UploadQRCodeButtonProps) {
  const backgroundColor = useThemeColor(theme.color.branding);

  return (
    <Pressable
      onPress={() => {
        void pickAndScanQRCode(onQRCodeScanned);
      }}
      style={[styles.button, { backgroundColor }]}
    >
      <ThemedText fontSize={theme.fontSize18} style={styles.buttonText}>
        <Trans>Upload QR Code</Trans>
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: theme.borderRadius20,
    padding: theme.space12,
  },
  buttonText: {
    color: theme.colorWhite,
    textAlign: "center",
  },
});
