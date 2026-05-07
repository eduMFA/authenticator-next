import * as Camera from "expo-camera";
import * as ImagePicker from "expo-image-picker";

export type UploadQRCodeButtonProps = {
  onQRCodeScanned: (result: Camera.BarcodeScanningResult | null) => void;
};

export async function pickAndScanQRCode(
  onQRCodeScanned: UploadQRCodeButtonProps["onQRCodeScanned"],
) {
  const pickerResult = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
  });

  if (pickerResult.canceled || pickerResult.assets.length === 0) {
    return;
  }

  const scannedBarcodes = await Camera.scanFromURLAsync(
    pickerResult.assets[0].uri || "",
    ["qr"],
  );

  onQRCodeScanned(scannedBarcodes.length > 0 ? scannedBarcodes[0] : null);
}
