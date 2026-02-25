import { theme } from "@/theme";
import { Trans, useLingui } from "@lingui/react/macro";
import * as Camera from "expo-camera";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Linking from "expo-linking";
import { useEffect, useRef, useState } from "react";
import { Button, StyleSheet, View } from "react-native";
import { ThemedText } from "./Themed";

export type Props = {
  onQRCodeScanned: (result: Camera.BarcodeScanningResult) => void;
};

export default function QRCodeScanner({ onQRCodeScanned }: Props) {
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions({});
  const lastScannedTimestampRef = useRef(0);
  const { t } = useLingui();

  const handleQRCodeScanned = async (result: Camera.BarcodeScanningResult) => {
    const now = Date.now();
    if (scanned || now - lastScannedTimestampRef.current < 2000) {
      return;
    }
    lastScannedTimestampRef.current = now;
    setScanned(true);
    onQRCodeScanned(result);
  };

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  if (!permission) {
    // Camera permissions are still loading.
    return <View style={styles.placeholder} />;
  }

  if (!permission.granted) {
    const text = permission.canAskAgain
      ? t`We need your permission to show the camera`
      : t`You can enable camera permissions in your device settings`;
    const handlePress = permission.canAskAgain
      ? () => requestPermission()
      : () => Linking.openSettings();
    const buttonTitle = permission.canAskAgain
      ? t`Grant permission`
      : t`Open Settings`;

    return (
      <View style={styles.placeholder}>
        <ThemedText
          style={styles.permissionText}
          fontWeight="bold"
          fontSize={20}
        >
          <Trans>Camera permission required</Trans>
        </ThemedText>
        <ThemedText style={styles.permissionText}>{text}</ThemedText>
        <Button title={buttonTitle} onPress={handlePress} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        onBarcodeScanned={handleQRCodeScanned}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  camera: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  permissionText: {
    alignContent: "center",
    color: theme.colorWhite,
    marginBottom: theme.space12,
    textAlign: "center",
  },
  placeholder: {
    alignItems: "center",
    backgroundColor: theme.colorBlack,
    flex: 1,
    justifyContent: "center",
    padding: theme.space16,
  },
});
