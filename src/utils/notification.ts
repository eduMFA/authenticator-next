import {
  NOTIFICATION_ACTION_ACCEPT,
  NOTIFICATION_ACTION_DECLINE,
  PUSH_AUTHENTICATION_CATEGORY,
} from "@/constants/notification";
import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import type { PushRequest, PushRequestData } from "@/types";
import { PushRequestStatus } from "@/types";
import {
  getMessaging,
  onMessage,
  setBackgroundMessageHandler,
} from "@react-native-firebase/messaging";
import type { FirebaseMessagingTypes } from "@react-native-firebase/messaging";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export type NotificationAction =
  | typeof NOTIFICATION_ACTION_ACCEPT
  | typeof NOTIFICATION_ACTION_DECLINE
  | "TAP";

export type NotificationResponseData = {
  nonce?: string;
  pushRequestId?: string;
} & Partial<PushRequestData>;

export type PushRequestHandler = (pushRequest: PushRequest) => void;

export type NotificationActionHandler = (
  actionId: string,
  notification: Notifications.Notification,
) => void;

export function isNotificationPermissionEnabled(
  settings: Notifications.NotificationPermissionsStatus | null,
): boolean {
  return Boolean(
    settings?.granted ||
    settings?.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL,
  );
}

/**
 * Configure notification categories with quick actions
 */
export async function setupNotificationCategories() {
  // Create Android notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("push-auth", {
      name: "Push Authentication",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  // Set up notification categories with actions for both platforms
  await Notifications.setNotificationCategoryAsync(
    PUSH_AUTHENTICATION_CATEGORY,
    [
      {
        identifier: NOTIFICATION_ACTION_ACCEPT,
        buttonTitle: i18n._(t`Accept`),
        options: {
          opensAppToForeground: false,
          isAuthenticationRequired: true,
        },
      },
      {
        identifier: NOTIFICATION_ACTION_DECLINE,
        buttonTitle: i18n._(t`Decline`),
        options: {
          opensAppToForeground: false,
          isDestructive: true,
        },
      },
    ],
  );
}

/**
 * Validates that the notification data contains all required fields for a push authentication request
 */
export function validatePushRequestData(
  data: unknown,
): data is PushRequestData {
  if (!data || typeof data !== "object") {
    return false;
  }

  const d = data as Record<string, unknown>;

  return (
    typeof d.nonce === "string" &&
    typeof d.question === "string" &&
    typeof d.serial === "string" &&
    typeof d.signature === "string" &&
    typeof d.sslverify === "string" &&
    typeof d.title === "string"
  );
}

/**
 * Parses a Firebase message into a PushRequest object
 * Returns null if the message is not a valid push authentication notification
 */
export function parsePushRequest(
  message: FirebaseMessagingTypes.RemoteMessage,
): PushRequest | null {
  const { category, data, messageId, sentTime } = message;

  // Check if this is a push authentication notification
  if (!data || category !== PUSH_AUTHENTICATION_CATEGORY) {
    console.log("Notification is not a PUSH_AUTHENTICATION category");
    return null;
  }

  // Validate the data structure
  if (!validatePushRequestData(data)) {
    console.error("Invalid push request data structure", data);
    return null;
  }

  // Create the PushRequest object
  const pushRequest: PushRequest = {
    id: messageId || `${data.nonce}-${Date.now()}`, // Fallback id if messageId is missing
    status: PushRequestStatus.Pending,
    sentAt: sentTime || Date.now(),
    nonce: data.nonce as string,
    question: data.question as string,
    serial: data.serial as string,
    signature: data.signature as string,
    sslverify: data.sslverify as string,
    title: data.title as string,
    url: data.url as string,
  };

  return pushRequest;
}

export function parsePushRequestFromNotificationData(
  data: unknown,
  fallbackId: string,
  sentAt: number = Date.now(),
): PushRequest | null {
  if (!validatePushRequestData(data)) {
    console.error("Invalid push request notification data", data);
    return null;
  }

  return {
    id: fallbackId,
    status: PushRequestStatus.Pending,
    sentAt,
    nonce: data.nonce,
    question: data.question,
    serial: data.serial,
    signature: data.signature,
    sslverify: data.sslverify,
    title: data.title,
    url: data.url,
  };
}

export function getNotificationResponseData(
  response: Notifications.NotificationResponse,
): NotificationResponseData {
  const data = response.notification.request.content.data;

  if (!data || typeof data !== "object") {
    return {};
  }

  return data;
}

export function getNotificationAction(
  actionIdentifier: string,
): NotificationAction | null {
  if (
    actionIdentifier === NOTIFICATION_ACTION_ACCEPT ||
    actionIdentifier === NOTIFICATION_ACTION_DECLINE
  ) {
    return actionIdentifier;
  }

  if (actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
    return "TAP";
  }

  return null;
}

export function getNotificationResponseKey(
  response: Notifications.NotificationResponse,
): string {
  const { identifier } = response.notification.request;
  return `${identifier}:${response.actionIdentifier}`;
}

/**
 * Add a listener for messages received while the app is in the foreground
 * Parses the message and returns a PushRequest if valid
 */
export function addMessageListener(handler: PushRequestHandler) {
  return onMessage(getMessaging(), async (message) => {
    console.log("Foreground message received:", message);

    const pushRequest = parsePushRequest(message);
    if (pushRequest) {
      handler(pushRequest);
    }
  });
}

/**
 * Add a listener for messages received while the app is in the background
 */
export function addBackgroundMessageHandler(handler: PushRequestHandler) {
  setBackgroundMessageHandler(getMessaging(), async (message) => {
    console.log("Background message received:", message);

    const pushRequest = parsePushRequest(message);
    if (pushRequest) {
      handler(pushRequest);
    }
  });
}

/**
 * Set up foreground notification event listener using expo-notifications
 */
export function setupForegroundNotificationHandler(
  handler: NotificationActionHandler,
) {
  // Handle notification responses (taps and action button presses)
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const action = getNotificationAction(response.actionIdentifier);
      const notification = response.notification;

      if (action) {
        console.log("User pressed an action:", action, notification);
        handler(action, notification);
      }
    },
  );

  return () => subscription.remove();
}

/**
 * Cancel all notifications
 */
export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Cancel a specific notification by ID
 */
export async function cancelNotification(notificationId: string) {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}
