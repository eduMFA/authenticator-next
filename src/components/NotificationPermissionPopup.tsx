import { ThemedText, useThemeColor } from "@/components/Themed";
import { theme } from "@/theme";
import { useLingui } from "@lingui/react/macro";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useState } from "react";
import {
  AppState,
  Dimensions,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

const POPUP_WIDTH = Math.min(Dimensions.get("window").width - 48, 380);

function isNotificationPermissionGranted(
  status: Notifications.NotificationPermissionsStatus,
) {
  return (
    status.granted ||
    status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

export function NotificationPermissionPopup() {
  const [isVisible, setIsVisible] = useState(false);
  const backgroundColor = useThemeColor(theme.color.background);
  const backgroundSecondary = useThemeColor(theme.color.backgroundSecondary);
  const borderColor = useThemeColor(theme.color.border);
  const brandingColor = useThemeColor(theme.color.branding);
  const errorBackgroundColor = useThemeColor(theme.color.errorBackground);
  const errorForegroundColor = useThemeColor(theme.color.errorForeground);
  const overlayColor = useThemeColor(theme.color.modalOverlay);
  const { t } = useLingui();

  const checkPermission = useCallback(async () => {
    try {
      const status = await Notifications.getPermissionsAsync();
      setIsVisible(!isNotificationPermissionGranted(status));
    } catch (error) {
      console.warn("Unable to read notification permission status", error);
      setIsVisible(false);
    }
  }, []);

  useEffect(() => {
    checkPermission();

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        checkPermission();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [checkPermission]);

  const handleOpenSettings = useCallback(() => {
    Linking.openSettings().catch((error) => {
      console.warn("Unable to open settings", error);
    });
  }, []);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
  }, []);

  return (
    <Modal
      visible={isVisible}
      transparent
      statusBarTranslucent
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={handleDismiss}
    >
      <View style={[styles.overlay, { backgroundColor: overlayColor }]}>
        <View
          style={[
            styles.popup,
            { backgroundColor, borderColor, width: POPUP_WIDTH },
          ]}
        >
          <View
            style={[
              styles.badge,
              {
                backgroundColor: errorBackgroundColor,
                borderColor: errorForegroundColor,
              },
            ]}
          >
            <ThemedText
              fontSize={theme.fontSize20}
              fontWeight="semiBold"
              style={[styles.badgeIcon, { color: errorForegroundColor }]}
            >
              !
            </ThemedText>
          </View>

          <ThemedText
            fontSize={theme.fontSize24}
            fontWeight="bold"
            style={styles.title}
          >
            {t`Turn on notifications`}
          </ThemedText>

          <ThemedText
            fontSize={theme.fontSize16}
            color={theme.color.textSecondary}
            style={styles.message}
          >
            {t`To approve sign-ins, we send you a notification. If notifications are off, requests will not arrive and sign-in will fail.`}
          </ThemedText>

          <View
            style={[
              styles.instructionsCard,
              { backgroundColor: backgroundSecondary, borderColor },
            ]}
          >
            <ThemedText
              fontSize={theme.fontSize14}
              color={theme.color.textSecondary}
              style={styles.instructionsTitle}
            >
              {t`Quick steps`}
            </ThemedText>
            <ThemedText fontSize={theme.fontSize16} style={styles.stepText}>
              {t`1. Tap Open Settings`}
            </ThemedText>
            <ThemedText fontSize={theme.fontSize16} style={styles.stepText}>
              {t`2. Open Notifications`}
            </ThemedText>
            <ThemedText fontSize={theme.fontSize16} style={styles.stepText}>
              {t`3. Turn on Allow Notifications`}
            </ThemedText>
            <ThemedText fontSize={theme.fontSize16} style={styles.stepText}>
              {t`4. Return to this app`}
            </ThemedText>
          </View>

          <View style={styles.actionsRow}>
            <Pressable
              style={[styles.button, styles.secondaryButton, { borderColor }]}
              onPress={handleDismiss}
            >
              <ThemedText
                fontSize={theme.fontSize16}
                fontWeight="semiBold"
                color={theme.color.textSecondary}
                style={styles.buttonText}
              >
                {t`Not now`}
              </ThemedText>
            </Pressable>

            <Pressable
              style={[
                styles.button,
                styles.primaryButton,
                { backgroundColor: brandingColor },
              ]}
              onPress={handleOpenSettings}
            >
              <ThemedText
                fontSize={theme.fontSize16}
                fontWeight="semiBold"
                style={[styles.buttonText, styles.primaryButtonText]}
              >
                {t`Open Settings`}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actionsRow: {
    flexDirection: "row",
    gap: theme.space12,
    marginTop: theme.space16,
    width: "100%",
  },
  badge: {
    alignItems: "center",
    borderRadius: theme.borderRadius45,
    borderWidth: 1,
    height: 52,
    justifyContent: "center",
    marginBottom: theme.space16,
    width: 52,
  },
  badgeIcon: {},
  button: {
    alignItems: "center",
    borderRadius: theme.borderRadius12,
    flex: 1,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: theme.space16,
    paddingVertical: theme.space12,
  },
  buttonText: {
    textAlign: "center",
  },
  instructionsCard: {
    borderRadius: theme.borderRadius12,
    borderWidth: 1,
    marginTop: theme.space16,
    padding: theme.space12,
    width: "100%",
  },
  instructionsTitle: {
    marginBottom: theme.space8,
    textTransform: "uppercase",
  },
  message: {
    lineHeight: 24,
    marginTop: theme.space12,
    textAlign: "left",
    width: "100%",
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.space24,
  },
  popup: {
    alignItems: "center",
    borderRadius: theme.borderRadius20,
    borderWidth: 1,
    padding: theme.space24,
    shadowColor: theme.colorBlack,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 24,
  },
  primaryButton: {
    backgroundColor: theme.colorBlack,
  },
  primaryButtonText: {
    color: theme.colorWhite,
  },
  secondaryButton: {
    borderWidth: 1,
  },
  stepText: {
    lineHeight: 22,
    marginTop: theme.space4,
  },
  title: {
    textAlign: "center",
  },
});
