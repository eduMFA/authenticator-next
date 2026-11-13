import { StaticColors } from "@/constants/theme";
import { openAppSettings } from "@/utils/open-links";
import * as Camera from "expo-camera";
import { CameraView } from "expo-camera";
import { useRef } from "react";
import { StyleSheet, View } from "react-native";
import { CameraPermissionDenied } from "./camera-permission-denied";
import { ScannerOverlay } from "./scanner-overlay";

export type Props = {
  onQRCodeScanned: (result: Camera.BarcodeScanningResult) => void;
  permission: Camera.PermissionResponse | null;
};

export default function QRCodeScanner({ onQRCodeScanned, permission }: Props) {
  const scannedRef = useRef(false);
  const lastScannedTimestampRef = useRef(0);
  const handleQRCodeScanned = async (result: Camera.BarcodeScanningResult) => {
    const now = Date.now();
    if (scannedRef.current || now - lastScannedTimestampRef.current < 2000) {
      return;
    }
    lastScannedTimestampRef.current = now;
    scannedRef.current = true;
    onQRCodeScanned(result);
  };

  if (!permission?.granted) {
    return <CameraPermissionDenied onOpenSettings={openAppSettings} />;
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
      <ScannerOverlay />
    </View>
  );
}

const styles = StyleSheet.create({
  camera: {
    flex: 1,
  },
  container: {
    backgroundColor: StaticColors.black,
    flex: 1,
  },
});
