import { PushRequest, PushRequestData, PushRequestStatus } from "@/types";
import {
  FirebaseMessagingTypes,
  getMessaging,
  onMessage,
  setBackgroundMessageHandler,
} from "@react-native-firebase/messaging";
import * as Notifications from "expo-notifications";

export type NotificationHandler = (
  message: FirebaseMessagingTypes.RemoteMessage,
) => void;

export type PushRequestHandler = (pushRequest: PushRequest) => void;

export type NotificationActionHandler = (
  actionId: string,
  notification: any,
) => void;

/**
 * Validates that the notification data contains all required fields for a push authentication request
 */
function validatePushRequestData(data: unknown): data is PushRequestData {
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
  if (!data || category !== "PUSH_AUTHENTICATION") {
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
      const actionId = response.actionIdentifier;
      const notification = response.notification;

      if (
        actionId === "ACCEPT" ||
        actionId === "DECLINE" ||
        actionId === Notifications.DEFAULT_ACTION_IDENTIFIER
      ) {
        console.log("User pressed an action:", actionId, notification);
        handler(
          actionId === Notifications.DEFAULT_ACTION_IDENTIFIER
            ? "default"
            : actionId,
          notification,
        );
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
