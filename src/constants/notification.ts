import * as Notifications from "expo-notifications";

export const PUSH_AUTHENTICATION_CATEGORY = "PUSH_AUTHENTICATION";

export const NOTIFICATION_ACTION_ACCEPT = "ACCEPT";
export const NOTIFICATION_ACTION_DECLINE = "DECLINE";

export const notificationPermissionOptions = {
  ios: {
    allowAlert: true,
    allowBadge: true,
    allowSound: true,
    provideAppNotificationSettings: true,
  },
} satisfies Notifications.NotificationPermissionsRequest;
