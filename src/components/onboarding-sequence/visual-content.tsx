import { Radii, Spacing, StaticColors } from "@/constants/theme";
import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

const logoSource = require("../../../assets/app-icons/edumfa.icon/Assets/logo.svg");

type VisualCardContentProps = {
  accentColor: string;
  index: number;
};

type WelcomeVisualContentProps = {
  logoColor: string;
};

export function WelcomeVisualContent({ logoColor }: WelcomeVisualContentProps) {
  return (
    <View style={styles.welcomeVisual}>
      <Image
        contentFit="contain"
        source={logoSource}
        style={styles.logo}
        tintColor={logoColor}
      />
    </View>
  );
}

export function VisualCardContent({
  accentColor,
  index,
}: VisualCardContentProps) {
  const accentStyle = useMemo(
    () => ({ backgroundColor: accentColor }),
    [accentColor],
  );
  const borderStyle = useMemo(
    () => ({ borderColor: accentColor }),
    [accentColor],
  );

  if (index === 1) {
    return (
      <View style={styles.notificationVisual}>
        <View style={[styles.notificationPhone, borderStyle]}>
          <View style={styles.notificationPhoneTop} />
          <View style={[styles.notificationBanner, borderStyle]}>
            <View style={[styles.notificationIconPlate, accentStyle]}>
              <SymbolView
                name={{ ios: "bell.fill", android: "notifications" }}
                size={22}
                tintColor={StaticColors.white}
              />
            </View>
            <View style={styles.notificationCopy}>
              <View style={[styles.notificationLineStrong, accentStyle]} />
              <View style={styles.notificationLine} />
            </View>
          </View>
          <View style={styles.notificationActions}>
            <View style={[styles.notificationAction, accentStyle]} />
            <View style={styles.notificationActionMuted} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.privacyVisual}>
      <View style={[styles.privacySheet, borderStyle]}>
        <View style={styles.privacyHeader}>
          <View style={[styles.privacyIconPlate, accentStyle]}>
            <SymbolView
              name={{ ios: "lock.shield.fill", android: "privacy_tip" }}
              size={24}
              tintColor={StaticColors.white}
            />
          </View>
          <View style={styles.privacyCopy}>
            <View style={[styles.privacyLineStrong, accentStyle]} />
            <View style={styles.privacyLine} />
          </View>
        </View>
        <View style={styles.privacyRows}>
          <View style={styles.privacyRow}>
            <View style={styles.privacyDotMuted} />
            <View style={styles.privacyLine} />
          </View>
          <View style={styles.privacyRow}>
            <View style={[styles.privacyDot, accentStyle]} />
            <View style={styles.privacyLineShort} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  logo: {
    height: 128,
    width: 128,
  },
  notificationAction: {
    borderRadius: Radii.xs,
    flex: 1,
    height: 18,
  },
  notificationActionMuted: {
    backgroundColor: StaticColors.grey,
    borderRadius: Radii.xs,
    flex: 1,
    height: 18,
    opacity: 0.24,
  },
  notificationActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    width: "100%",
  },
  notificationBanner: {
    alignItems: "center",
    borderCurve: "continuous",
    borderRadius: Radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: Spacing.md,
    padding: Spacing.md,
    width: "100%",
  },
  notificationCopy: {
    flex: 1,
    gap: Spacing.sm,
  },
  notificationIconPlate: {
    alignItems: "center",
    borderCurve: "continuous",
    borderRadius: Radii.lg,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  notificationLine: {
    backgroundColor: StaticColors.grey,
    borderRadius: Radii.sm,
    height: 7,
    opacity: 0.28,
    width: "68%",
  },
  notificationLineStrong: {
    borderRadius: Radii.sm,
    height: 8,
    width: "86%",
  },
  notificationPhone: {
    borderCurve: "continuous",
    borderRadius: Radii.xl,
    borderWidth: 1,
    gap: Spacing.md,
    padding: Spacing.lg,
    width: 220,
  },
  notificationPhoneTop: {
    alignSelf: "center",
    backgroundColor: StaticColors.grey,
    borderRadius: Radii.sm,
    height: 5,
    opacity: 0.28,
    width: 48,
  },
  notificationVisual: {
    alignItems: "center",
    justifyContent: "center",
  },
  privacyCopy: {
    flex: 1,
    gap: Spacing.sm,
  },
  privacyDot: {
    borderRadius: Radii.xl,
    height: 10,
    width: 10,
  },
  privacyDotMuted: {
    backgroundColor: StaticColors.grey,
    borderRadius: Radii.xl,
    height: 10,
    opacity: 0.32,
    width: 10,
  },
  privacyHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.md,
  },
  privacyIconPlate: {
    alignItems: "center",
    borderCurve: "continuous",
    borderRadius: Radii.lg,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  privacyLine: {
    backgroundColor: StaticColors.grey,
    borderRadius: Radii.sm,
    flex: 1,
    height: 7,
    opacity: 0.28,
  },
  privacyLineShort: {
    backgroundColor: StaticColors.grey,
    borderRadius: Radii.sm,
    flex: 0.68,
    height: 7,
    opacity: 0.22,
  },
  privacyLineStrong: {
    borderRadius: Radii.sm,
    height: 8,
    width: "86%",
  },
  privacyRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.sm,
  },
  privacyRows: {
    gap: Spacing.md,
  },
  privacySheet: {
    borderCurve: "continuous",
    borderRadius: Radii.xl,
    borderWidth: 1,
    gap: Spacing.lg,
    padding: Spacing.lg,
    width: 220,
  },
  privacyVisual: {
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeVisual: {
    alignItems: "center",
    justifyContent: "center",
  },
});
