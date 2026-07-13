import { StatusCard } from "@/components/status-card";
import { Spacing } from "@/constants/theme";
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
};

export function WelcomeStepActions({
  accentColor,
  label,
  onContinue,
}: WelcomeStepActionsProps) {
  return (
    <View style={styles.buttonStack}>
      <ActionButton
        accentColor={accentColor}
        icon={{ ios: "arrow.right", android: "arrow_forward" }}
        label={label}
        onPress={onContinue}
      />
    </View>
  );
}

type NotificationStepActionsProps = {
  accentColor: string;
  hasNotificationPermission: boolean;
  isCheckingPermission: boolean;
  isRequestingPermission: boolean;
  onContinue: () => void;
  onEnableNotifications: () => void;
  onOpenSettings: () => void;
  onSkip: () => void;
  permissionStatus: Notifications.NotificationPermissionsStatus | null;
  textColor: ColorValue;
};

export function NotificationStepActions({
  accentColor,
  hasNotificationPermission: hasNotificationsEnabled,
  isCheckingPermission,
  isRequestingPermission,
  onContinue,
  onEnableNotifications,
  onOpenSettings,
  onSkip,
  permissionStatus,
  textColor,
}: NotificationStepActionsProps) {
  const { t } = useLingui();
  const hasNotificationDecision =
    !isNotificationPermissionPending(permissionStatus);

  if (hasNotificationsEnabled) {
    return (
      <View style={styles.buttonStack}>
        <StatusCard
          description={t`You’re ready to receive and approve sign-in requests.`}
          title={t`Notifications are enabled`}
          variant="success"
        />
        <ActionButton
          accentColor={accentColor}
          icon={{ ios: "arrow.right", android: "arrow_forward" }}
          label={t`Continue`}
          onPress={onContinue}
        />
      </View>
    );
  }

  if (hasNotificationDecision) {
    return (
      <View style={[styles.buttonStack, styles.buttonStackCompact]}>
        <StatusCard
          description={t`Turn on notifications in Settings so you can respond when a request arrives.`}
          title={t`Sign-in requests may go unnoticed`}
          variant="error"
        />
        <ActionButton
          accentColor={accentColor}
          icon={{ ios: "gearshape.fill", android: "settings" }}
          label={t`Open notification settings`}
          onPress={onOpenSettings}
        />
        <TextButton color={textColor} label={t`Not now`} onPress={onSkip} />
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
      />
    </View>
  );
}

type CrashReportsStepActionsProps = {
  accentColor: string;
  onDecline: () => void;
  onOptIn: () => void;
};

export function CrashReportsStepActions({
  accentColor,
  onDecline,
  onOptIn,
}: CrashReportsStepActionsProps) {
  const { t } = useLingui();

  return (
    <View style={styles.buttonStack}>
      <StatusCard
        description={t`Help improve reliability by sharing crash and error reports. They never include token secrets, passwords, or institution names.`}
        icon={{ ios: "hand.raised.fill", android: "privacy_tip" }}
        iconPlacement="side"
        title={t`Anonymous reports`}
        variant="neutral"
      />
      <ActionButton
        accentColor={accentColor}
        icon={{ ios: "xmark", android: "close" }}
        label={t`Do not share reports`}
        onPress={onDecline}
      />
      <ActionButton
        accentColor={accentColor}
        icon={{ ios: "checkmark.shield.fill", android: "verified_user" }}
        label={t`Share anonymous reports`}
        onPress={onOptIn}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  buttonStack: {
    gap: Spacing.md,
    width: "100%",
  },
  buttonStackCompact: {
    gap: Spacing.sm,
  },
});
