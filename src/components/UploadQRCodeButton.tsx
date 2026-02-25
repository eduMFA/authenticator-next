import { theme } from "@/theme";
import { Trans } from "@lingui/react/macro";
import * as Camera from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { Pressable, StyleSheet } from "react-native";
import { ThemedText, useThemeColor } from "./Themed";

export type UploadQRCodeButtonProps = {
  onQRCodeScanned: (result: Camera.BarcodeScanningResult | null) => void;
};

export function UploadQRCodeButton({
  onQRCodeScanned,
}: UploadQRCodeButtonProps) {
  const backgroundColor = useThemeColor(theme.color.branding);

  async function handlePress() {
    let pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
    });
    if (pickerResult.canceled || pickerResult.assets.length === 0) return;
    const scannedBarcodes = await Camera.scanFromURLAsync(
      pickerResult.assets[0].uri || "",
      ["qr"],
    );
    onQRCodeScanned(scannedBarcodes.length > 0 ? scannedBarcodes[0] : null);
  }

  return (
    <Pressable
      onPress={handlePress}
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
