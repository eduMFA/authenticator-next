import { usePushRequestStore } from "@/stores/push-request";
import { useTokenStore } from "@/stores/token";
import type { PushRequest } from "@/types/push-request";
import { PushRequestStatus } from "@/types/push-request";
import { base32ToBase64 } from "@/utils/crypto";
import {
  getNotificationAction,
  getNotificationResponseData,
  parsePushRequestFromNotificationData,
} from "@/utils/notification";
import { buildPushRequestSignedData } from "@/utils/push-request";
import { verifyMessage } from "@/utils/rsa";
import { waitForNotificationStores } from "@/utils/notification-stores";
import { submitNativeNotification } from "@/utils/native-notifications";
import type * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { findTokenForPushRequest, handlePushAuthRequest } from "./push-auth";
import { synchronizeNotificationState } from "./notification-state";

const submissions = new Map<string, Promise<boolean>>();

export async function receivePushRequest(
  request: PushRequest,
): Promise<PushRequest | null> {
  await waitForNotificationStores();
  const token = findTokenForPushRequest(
    request,
    useTokenStore.getState().tokens,
  );
  if (!token?.serverPublicKey) return null;

  const valid = await verifyMessage(
    buildPushRequestSignedData(request),
    base32ToBase64(request.signature),
    token.serverPublicKey,
  );
  if (!valid) return null;

  const store = usePushRequestStore.getState();
  store.addPushRequest(request);
  const stored = store.getPushRequestByNonce(request.nonce);
  return stored?.serial === request.serial ? stored : null;
}

// Share submission deduplication between popup buttons and notification actions.
export async function submitPushRequest(
  request: PushRequest,
): Promise<boolean> {
  await waitForNotificationStores();
  const key = `${request.serial}:${request.nonce}`;
  const existing = submissions.get(key);
  if (existing) return existing;

  const submission = (async () => {
    const store = usePushRequestStore.getState();
    const stored = store.getPushRequestByNonce(request.nonce);
    if (!stored || stored.serial !== request.serial) return false;
    if (stored.status !== PushRequestStatus.Pending) {
      return (
        stored.status === PushRequestStatus.Accepted ||
        stored.status === PushRequestStatus.Declined
      );
    }
    if (Date.now() - stored.sentAt >= 120_000) {
      store.updatePushRequestStatus(stored.id, PushRequestStatus.Expired);
      return false;
    }
    if (
      request.status !== PushRequestStatus.Accepted &&
      request.status !== PushRequestStatus.Declined
    )
      return false;

    const token = findTokenForPushRequest(
      stored,
      useTokenStore.getState().tokens,
    );
    if (!token) return false;
    const response = { ...stored, status: request.status };
    let success: boolean;
    if (Platform.OS === "ios") {
      await synchronizeNotificationState();
      success = await submitNativeNotification(response);
    } else {
      success = (await handlePushAuthRequest(response, token)).success;
    }
    if (success) {
      if (Platform.OS !== "ios") {
        store.updatePushRequestStatus(stored.id, request.status);
      }
      // Presentation errors must not turn a successful server response into a retry.
      await synchronizeNotificationState().catch((error: unknown) => {
        console.error("Notification state reconciliation failed:", error);
      });
    }
    return success;
  })();
  submissions.set(key, submission);
  try {
    return await submission;
  } finally {
    submissions.delete(key);
  }
}

export async function handleNotificationResponse(
  response: Notifications.NotificationResponse,
): Promise<boolean> {
  try {
    const action = getNotificationAction(response.actionIdentifier);
    if (!action) return false;
    await waitForNotificationStores();
    const data = getNotificationResponseData(response);
    const parsed = parsePushRequestFromNotificationData(
      data,
      data.pushRequestId ?? response.notification.request.identifier,
      response.notification.date,
    );
    const store = usePushRequestStore.getState();
    const request = parsed
      ? await receivePushRequest(parsed)
      : data.nonce
        ? store.getPushRequestByNonce(data.nonce)
        : data.pushRequestId
          ? store.getPushRequestById(data.pushRequestId)
          : null;
    if (!request) return false;
    if (action === "TAP") return true;
    return await submitPushRequest({
      ...request,
      status:
        action === "ACCEPT"
          ? PushRequestStatus.Accepted
          : PushRequestStatus.Declined,
    });
  } catch (error) {
    console.error("Notification action failed:", error);
    return false;
  }
}
