import { Button, Host, Icon, Row, Spacer, Text } from "@expo/ui";
import { height as composeHeight } from "@expo/ui/jetpack-compose/modifiers";
import { buttonStyle, controlSize } from "@expo/ui/swift-ui/modifiers";
import { useLingui } from "@lingui/react/macro";
import * as Camera from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Platform } from "react-native";

const BUTTON_MODIFIERS = Platform.select({
  android: [composeHeight(100)],
  ios: [controlSize("large"), buttonStyle("glassProminent")],
});

const QR_CODE_SCANNER_ICON = Icon.select({
  ios: "qrcode.viewfinder",
  android: require("@expo/material-symbols/qr_code_scanner.xml"),
});

const ANDROID_TEXT_STYLE = Platform.select({
  android: { fontSize: 20 },
});

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

export function UploadQRCodeButton({
  onQRCodeScanned,
}: UploadQRCodeButtonProps) {
  const { t } = useLingui();
  const [hostWidth, setHostWidth] = useState(0);

  return (
    <Host
      matchContents={{ vertical: true }}
      onLayout={({ nativeEvent }) => {
        setHostWidth(nativeEvent.layout.width);
      }}
    >
      <Button
        modifiers={BUTTON_MODIFIERS}
        onPress={() => {
          void pickAndScanQRCode(onQRCodeScanned);
        }}
        style={{
          width: hostWidth || undefined,
        }}
      >
        <Row alignment="center" spacing={6}>
          <Spacer flexible />
          <Icon
            name={QR_CODE_SCANNER_ICON}
            accessibilityLabel={t`QR code scanner`}
          />
          <Text numberOfLines={1} textStyle={ANDROID_TEXT_STYLE}>
            {t`Upload QR Code`}
          </Text>
          <Spacer flexible />
        </Row>
      </Button>
    </Host>
  );
}
