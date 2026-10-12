import { useNotificationStore } from "@/stores/notification";
import {
  handleNotificationResponse,
  receivePushRequest,
} from "@/services/push-notification";
import {
  addMessageListener,
  isNotificationPermissionEnabled,
} from "@/utils/notification";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { usePushRequestStore } from "@/stores/push-request";
import { useTokenStore } from "@/stores/token";
import { synchronizeNotificationState } from "@/services/notification-state";
import { addNativeNotificationListener } from "@/utils/native-notifications";

export function useNotificationStatus() {
  const fcmToken = useNotificationStore((state) => state.fcmToken);
  const isInitialized = useNotificationStore((state) => state.isInitialized);
  const isInitializing = useNotificationStore((state) => state.isInitializing);
  const permissionStatus = useNotificationStore(
    (state) => state.permissionStatus,
  );
  const pushCapability = useNotificationStore((state) => state.pushCapability);
  const initialize = useNotificationStore((state) => state.initialize);
  const checkPermissions = useNotificationStore(
    (state) => state.checkPermissions,
  );
  const getFcmToken = useNotificationStore((state) => state.getFcmToken);
  const requestPermissions = useNotificationStore(
    (state) => state.requestPermissions,
  );
  const reset = useNotificationStore((state) => state.reset);
  const hasPermission = isNotificationPermissionEnabled(permissionStatus);

  return {
    checkPermissions,
    fcmToken,
    getFcmToken,
    hasPermission,
    initialize,
    isInitialized,
    isInitializing,
    permissionStatus,
    pushCapability,
    requestPermissions,
    reset,
  };
}

export function useNotifications() {
  const notificationStatus = useNotificationStatus();

  useEffect(() => {
    const unsubscribeMessage = addMessageListener(async (request) => {
      try {
        await receivePushRequest(request);
      } catch (error) {
        console.error("Push request verification failed:", error);
      }
    });
    const handleResponse = (response: Notifications.NotificationResponse) => {
      void handleNotificationResponse(response);
    };
    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener(handleResponse);
    const handleLastResponse = () => {
      const response = Notifications.getLastNotificationResponse();
      if (response) handleResponse(response);
    };
    const reconcile = () => {
      void synchronizeNotificationState().catch((error: unknown) => {
        console.error("Notification state reconciliation failed:", error);
      });
    };
    const unsubscribeRequests = usePushRequestStore.subscribe(reconcile);
    const unsubscribeTokens = useTokenStore.subscribe(reconcile);
    const unsubscribeNative =
      Platform.OS === "ios"
        ? addNativeNotificationListener(reconcile)
        : () => {};
    void synchronizeNotificationState()
      .then(handleLastResponse)
      .catch((error: unknown) => {
        console.error("Initial notification reconciliation failed:", error);
      });
    const expiryTimer = setInterval(reconcile, 15_000);
    const appStateSubscription = AppState.addEventListener(
      "change",
      (state) => {
        if (state === "active") {
          reconcile();
          handleLastResponse();
        }
      },
    );

    return () => {
      unsubscribeMessage();
      responseSubscription.remove();
      appStateSubscription.remove();
      unsubscribeRequests();
      unsubscribeTokens();
      unsubscribeNative();
      clearInterval(expiryTimer);
    };
  }, []);

  return notificationStatus;
}
