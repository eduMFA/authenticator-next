import { Button, Host, Row, Spacer, Text } from "@expo/ui/jetpack-compose";
import {
  fillMaxWidth,
  height,
  width,
} from "@expo/ui/jetpack-compose/modifiers";
import { useLingui } from "@lingui/react/macro";
import { Color } from "expo-router";
import { SymbolView } from "expo-symbols";
import { StyleSheet } from "react-native";
import { pickAndScanQRCode, UploadQRCodeButtonProps } from "./shared";

export function UploadQRCodeButton({
  onQRCodeScanned,
}: UploadQRCodeButtonProps) {
  const { t } = useLingui();

  return (
    <Host matchContents={{ vertical: true }} style={styles.host}>
      <Button
        modifiers={[fillMaxWidth(), height(60)]}
        onClick={() => void pickAndScanQRCode(onQRCodeScanned)}
      >
        <Row verticalAlignment="center">
          <SymbolView
            name={{ android: "qr_code_scanner" }}
            tintColor={Color.android.dynamic.onPrimary}
          />
          <Spacer modifiers={[width(5)]} />
          <Text>{t`Upload QR Code`}</Text>
        </Row>
      </Button>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {
    width: "100%",
  },
});
