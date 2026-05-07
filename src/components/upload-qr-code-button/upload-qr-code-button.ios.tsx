import { Button, Host, HStack, Image, Spacer, Text } from "@expo/ui/swift-ui";
import { buttonStyle, controlSize, frame } from "@expo/ui/swift-ui/modifiers";
import { useLingui } from "@lingui/react/macro";
import { pickAndScanQRCode, UploadQRCodeButtonProps } from "./shared";

export function UploadQRCodeButton({
  onQRCodeScanned,
}: UploadQRCodeButtonProps) {
  const { t } = useLingui();

  return (
    <Host matchContents>
      <Button
        modifiers={[
          buttonStyle("borderedProminent"),
          frame({ maxWidth: 10_000, minHeight: 52 }),
          controlSize("large"),
        ]}
        onPress={() => {
          void pickAndScanQRCode(onQRCodeScanned);
        }}
      >
        <HStack
          spacing={6}
          modifiers={[frame({ maxWidth: 10_000, alignment: "center" })]}
        >
          <Spacer />
          <Image systemName="qrcode.viewfinder" />
          <Text>{t`Upload QR Code`}</Text>
          <Spacer />
        </HStack>
      </Button>
    </Host>
  );
}
