import { Radii, StaticColors } from "@/constants/theme";
import { StyleSheet, View } from "react-native";

export type QRCodeViewfinderIconProps = {
  size?: "compact" | "large";
};

export function QRCodeViewfinderIcon({
  size = "compact",
}: QRCodeViewfinderIconProps) {
  const isLarge = size === "large";

  return (
    <View style={[styles.container, isLarge && styles.containerLarge]}>
      <View style={[styles.frame, isLarge && styles.frameLarge]}>
        <View style={[styles.corner, styles.cornerTopLeft]} />
        <View style={[styles.corner, styles.cornerTopRight]} />
        <View style={[styles.corner, styles.cornerBottomLeft]} />
        <View style={[styles.corner, styles.cornerBottomRight]} />
        <View style={styles.dot} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    borderColor: StaticColors.grey,
    borderRadius: Radii.lg,
    borderWidth: 1,
    height: 54,
    justifyContent: "center",
    width: 54,
  },
  containerLarge: {
    backgroundColor: StaticColors.black,
    borderRadius: Radii.xl,
    height: 76,
    width: 76,
  },
  corner: {
    borderColor: StaticColors.white,
    height: 14,
    position: "absolute",
    width: 14,
  },
  cornerBottomLeft: {
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    bottom: 0,
    left: 0,
  },
  cornerBottomRight: {
    borderBottomWidth: 3,
    borderRightWidth: 3,
    bottom: 0,
    right: 0,
  },
  cornerTopLeft: {
    borderLeftWidth: 3,
    borderTopWidth: 3,
    left: 0,
    top: 0,
  },
  cornerTopRight: {
    borderRightWidth: 3,
    borderTopWidth: 3,
    right: 0,
    top: 0,
  },
  dot: {
    backgroundColor: StaticColors.white,
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  frame: {
    alignItems: "center",
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  frameLarge: {
    height: 44,
    width: 44,
  },
});
