import { ThemedText } from "@/components/themed-text";
import { Radii, Spacing, StaticColors, Typography } from "@/constants/theme";
import { Trans } from "@lingui/react/macro";
import { StyleSheet, View } from "react-native";

const scanHintBackgroundColor = "rgba(0, 0, 0, 0.62)";
const scanOverlayBackgroundColor = "rgba(0, 0, 0, 0.34)";
const scanWindowBorderColor = "rgba(255, 255, 255, 0.38)";
const scanWindowBackgroundColor = "rgba(0, 0, 0, 0.08)";

export function ScannerOverlay() {
  return (
    <View pointerEvents="none" style={styles.scanOverlay}>
      <View style={styles.scanDim} />
      <View style={styles.scanWindow}>
        <View style={[styles.scanCorner, styles.scanCornerTopLeft]} />
        <View style={[styles.scanCorner, styles.scanCornerTopRight]} />
        <View style={[styles.scanCorner, styles.scanCornerBottomLeft]} />
        <View style={[styles.scanCorner, styles.scanCornerBottomRight]} />
      </View>
      <View style={styles.scanHint}>
        <ThemedText
          fontSize={Typography.fontSize14}
          fontWeight="semiBold"
          style={styles.scanHintText}
        >
          <Trans>Place the QR code inside the frame</Trans>
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scanCorner: {
    borderColor: StaticColors.white,
    height: 42,
    position: "absolute",
    width: 42,
  },
  scanCornerBottomLeft: {
    borderBottomLeftRadius: Radii.lg,
    borderBottomWidth: 5,
    borderLeftWidth: 5,
    bottom: -1,
    left: -1,
  },
  scanCornerBottomRight: {
    borderBottomRightRadius: Radii.lg,
    borderBottomWidth: 5,
    borderRightWidth: 5,
    bottom: -1,
    right: -1,
  },
  scanCornerTopLeft: {
    borderLeftWidth: 5,
    borderTopLeftRadius: Radii.lg,
    borderTopWidth: 5,
    left: -1,
    top: -1,
  },
  scanCornerTopRight: {
    borderRightWidth: 5,
    borderTopRightRadius: Radii.lg,
    borderTopWidth: 5,
    right: -1,
    top: -1,
  },
  scanDim: {
    backgroundColor: scanOverlayBackgroundColor,
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  scanHint: {
    alignItems: "center",
    backgroundColor: scanHintBackgroundColor,
    borderRadius: Radii.pill,
    bottom: Spacing.lg,
    left: Spacing.xl,
    minHeight: 34,
    paddingHorizontal: Spacing.md,
    position: "absolute",
    right: Spacing.xl,
  },
  scanHintText: {
    color: StaticColors.white,
    lineHeight: 34,
    textAlign: "center",
  },
  scanOverlay: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  scanWindow: {
    backgroundColor: scanWindowBackgroundColor,
    borderColor: scanWindowBorderColor,
    borderRadius: Radii.xl,
    borderWidth: 1,
    height: 188,
    width: 188,
  },
});
