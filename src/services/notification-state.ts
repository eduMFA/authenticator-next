import { usePushRequestStore } from "@/stores/push-request";
import { useTokenStore } from "@/stores/token";
import { PushRequestStatus } from "@/types/push-request";
import { synchronizeNativeNotifications } from "@/utils/native-notifications";
import { waitForNotificationStores } from "@/utils/notification-stores";
import { getNotificationResponseData } from "@/utils/notification";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { PUSH_AUTHENTICATION_CATEGORY } from "@/constants/notification";

let synchronization: Promise<void> = Promise.resolve();

/** Reconcile device notification state across all enrolled backends. */
export function synchronizeNotificationState(): Promise<void> {
  const next = synchronization.then(async () => {
    await waitForNotificationStores();
    const tokens = useTokenStore.getState().tokens;
    const store = usePushRequestStore.getState();
    if (
      store.pushRequests.some(
        (request) =>
          request.status === PushRequestStatus.Pending &&
          Date.now() - request.sentAt >= 120_000,
      )
    )
      store.clearExpiredPushRequests();

    if (Platform.OS === "ios") {
      const results = await synchronizeNativeNotifications(
        tokens,
        usePushRequestStore.getState().pushRequests,
      );
      for (const request of results) {
        if (!tokens.some((token) => token.id === request.serial)) continue;
        store.addPushRequest(request);
        const stored = store.getPushRequestByNonce(request.nonce);
        if (
          stored?.serial === request.serial &&
          stored.status !== request.status &&
          (request.status !== PushRequestStatus.Pending ||
            stored.status === PushRequestStatus.Pending)
        ) {
          store.updatePushRequestStatus(stored.id, request.status);
        }
      }
      return;
    }

    const pending = usePushRequestStore
      .getState()
      .pushRequests.filter(
        (request) =>
          request.status === PushRequestStatus.Pending &&
          Date.now() - request.sentAt < 120_000 &&
          tokens.some((token) => token.id === request.serial),
      );
    for (const notification of await Notifications.getPresentedNotificationsAsync()) {
      if (
        notification.request.content.categoryIdentifier !==
        PUSH_AUTHENTICATION_CATEGORY
      )
        continue;
      const data = getNotificationResponseData({
        notification,
        actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
      });
      if (!data.nonce || !data.serial) continue;
      if (
        !pending.some(
          (request) =>
            request.nonce === data.nonce && request.serial === data.serial,
        )
      ) {
        await Notifications.dismissNotificationAsync(
          notification.request.identifier,
        );
      }
    }
    await Notifications.setBadgeCountAsync(pending.length);
  });
  // A failed attempt must not block future reconciliation or action retries.
  synchronization = next.catch(() => {});
  return next;
}
