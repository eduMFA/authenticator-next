import { StatusCard } from "@/components/status-card";
import { ONBOARDING_MAX_FONT_SIZE_MULTIPLIER } from "@/constants/onboarding";
import { Spacing } from "@/constants/theme";
import type {
  PushNotificationCapability,
  PushRegistrationStatus,
} from "@/types/notification";
import { isNotificationPermissionPending } from "@/utils/notification";
import { useLingui } from "@lingui/react/macro";
import * as Notifications from "expo-notifications";
import { StyleSheet, View, type ColorValue } from "react-native";
import { ActionButton } from "./action-button";
import { TextButton } from "./text-button";

type WelcomeStepActionsProps = {
  accentColor: string;
  label: string;
  onContinue: () => void;
  scale: number;
};

export function WelcomeStepActions({
  accentColor,
  label,
  onContinue,
  scale,
}: WelcomeStepActionsProps) {
  return (
    <View style={styles.buttonStack}>
      <ActionButton
        accentColor={accentColor}
        icon={{ ios: "arrow.right", android: "arrow_forward" }}
        label={label}
        onPress={onContinue}
        scale={scale}
      />
    </View>
  );
}

type NotificationStepActionsProps = {
  accentColor: string;
  hasNotificationPermission: boolean;
  isCheckingPermission: boolean;
  isRequestingPermission: boolean;
  needsPermissionRequest: boolean;
  onContinue: () => void;
  onEnableNotifications: () => void;
  onOpenSettings: () => void;
  onRetryRegistration: () => void;
  onSkip: () => void;
  permissionStatus: Notifications.NotificationPermissionsStatus | null;
  pushCapability: PushNotificationCapability | null;
  registrationStatus: PushRegistrationStatus;
  scale: number;
  textColor: ColorValue;
};

export function NotificationStepActions({
  accentColor,
  hasNotificationPermission: hasNotificationsEnabled,
  isCheckingPermission,
  isRequestingPermission,
  needsPermissionRequest,
  onContinue,
  onEnableNotifications,
  onOpenSettings,
  onRetryRegistration,
  onSkip,
  permissionStatus,
  pushCapability,
  registrationStatus,
  scale,
  textColor,
}: NotificationStepActionsProps) {
  const { t } = useLingui();
  const hasNotificationDecision =
    !needsPermissionRequest &&
    !isNotificationPermissionPending(permissionStatus);

  if (pushCapability !== null && pushCapability !== "supported") {
    return (
      <View style={styles.buttonStack}>
        <StatusCard
          description={
            pushCapability === "ios-simulator"
              ? t`Use a physical iOS device to test push notifications. You can still open the app to check for requests in the simulator.`
              : t`This device can't receive push notifications. Open eduMFA Push when signing in, or pull down to check for requests.`
          }
          icon={{ ios: "arrow.down.circle.fill", android: "refresh" }}
          maxFontSizeMultiplier={ONBOARDING_MAX_FONT_SIZE_MULTIPLIER}
          scale={scale}
          title={
            pushCapability === "ios-simulator"
              ? t`Running in the iOS simulator`
              : t`Check requests in the app`
          }
          variant="neutral"
        />
        <ActionButton
          accentColor={accentColor}
          icon={{ ios: "arrow.right", android: "arrow_forward" }}
          label={t`Continue`}
          onPress={onContinue}
          scale={scale}
        />
      </View>
    );
  }

  if (registrationStatus === "pending" && hasNotificationsEnabled) {
    return (
      <View style={styles.buttonStack}>
        <ActionButton
          accentColor={accentColor}
          icon={{ ios: "arrow.clockwise", android: "refresh" }}
          label={t`Setting up notifications…`}
          onPress={onRetryRegistration}
          isLoading
          scale={scale}
        />
        <TextButton
          color={textColor}
          label={t`Not now`}
          onPress={onSkip}
          scale={scale}
        />
      </View>
    );
  }

  if (registrationStatus === "failed" && hasNotificationsEnabled) {
    return (
      <View style={styles.buttonStack}>
        <StatusCard
          title={t`Notifications aren't ready yet`}
          description={t`Notifications couldn't be set up. Check your connection and device settings, then try again. You can still open the app to check for requests.`}
          variant="danger"
          scale={scale}
          maxFontSizeMultiplier={ONBOARDING_MAX_FONT_SIZE_MULTIPLIER}
        />
        <ActionButton
          accentColor={accentColor}
          icon={{ ios: "arrow.clockwise", android: "refresh" }}
          label={t`Try again`}
          onPress={onRetryRegistration}
          isLoading={isCheckingPermission}
          scale={scale}
        />
        <TextButton
          color={textColor}
          label={t`Not now`}
          onPress={onSkip}
          scale={scale}
        />
      </View>
    );
  }

  if (hasNotificationsEnabled && !needsPermissionRequest) {
    return (
      <View style={styles.buttonStack}>
        <StatusCard
          description={t`You’re ready to receive and approve sign-in requests.`}
          maxFontSizeMultiplier={ONBOARDING_MAX_FONT_SIZE_MULTIPLIER}
          title={t`Notifications are enabled`}
          variant="success"
          scale={scale}
        />
        <ActionButton
          accentColor={accentColor}
          icon={{ ios: "arrow.right", android: "arrow_forward" }}
          label={t`Continue`}
          onPress={onContinue}
          scale={scale}
        />
      </View>
    );
  }

  if (hasNotificationDecision) {
    return (
      <View style={styles.buttonStack}>
        <StatusCard
          description={t`Turn on notifications in Settings so you can respond when a request arrives.`}
          maxFontSizeMultiplier={ONBOARDING_MAX_FONT_SIZE_MULTIPLIER}
          title={t`Sign-in requests may go unnoticed`}
          variant="error"
          scale={scale}
        />
        <ActionButton
          accentColor={accentColor}
          icon={{ ios: "gearshape.fill", android: "settings" }}
          label={t`Open notification settings`}
          onPress={onOpenSettings}
          scale={scale}
        />
        <TextButton
          color={textColor}
          label={t`Not now`}
          onPress={onSkip}
          scale={scale}
        />
      </View>
    );
  }

  return (
    <View style={styles.buttonStack}>
      <ActionButton
        accentColor={accentColor}
        icon={{ ios: "bell.fill", android: "notifications" }}
        isLoading={isRequestingPermission || isCheckingPermission}
        label={t`Enable notifications`}
        onPress={onEnableNotifications}
        scale={scale}
      />
      <TextButton
        color={textColor}
        label={t`Not now`}
        onPress={onSkip}
        scale={scale}
      />
    </View>
  );
}

type CrashReportsStepActionsProps = {
  accentColor: string;
  onDecline: () => void;
  onOptIn: () => void;
  scale: number;
};

export function CrashReportsStepActions({
  accentColor,
  onDecline,
  onOptIn,
  scale,
}: CrashReportsStepActionsProps) {
  const { t } = useLingui();

  return (
    <View style={styles.buttonStack}>
      <StatusCard
        description={t`Help improve reliability by sharing crash and error reports. They never include token secrets, passwords, or institution names.`}
        icon={{ ios: "hand.raised.fill", android: "privacy_tip" }}
        iconPlacement="side"
        maxFontSizeMultiplier={ONBOARDING_MAX_FONT_SIZE_MULTIPLIER}
        title={t`Anonymous reports`}
        variant="neutral"
        scale={scale}
      />
      <ActionButton
        accentColor={accentColor}
        icon={{ ios: "xmark", android: "close" }}
        label={t`Don't share anonymous reports`}
        onPress={onDecline}
        scale={scale}
      />
      <ActionButton
        accentColor={accentColor}
        icon={{ ios: "checkmark.shield.fill", android: "verified_user" }}
        label={t`Share anonymous reports`}
        onPress={onOptIn}
        scale={scale}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  buttonStack: {
    gap: Spacing.sm,
    width: "100%",
  },
});
