import { verifyIncomingPushRequest } from "@/services/push-delivery";
import { useNotificationStore } from "@/stores/notification";
import { usePushRequestStore } from "@/stores/push-request";
import type {
  NotificationAction,
  NotificationResponseData,
} from "@/types/notification";
import type { PushRequest } from "@/types/push-request";
import {
  addMessageListener,
  getNotificationAction,
  getNotificationResponseData,
  getNotificationResponseKey,
  isNotificationPermissionEnabled,
  parsePushRequestFromNotificationData,
} from "@/utils/notification";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect } from "react";
import { Platform } from "react-native";
import { useChallengePolling } from "./use-challenge-polling";

export type { NotificationAction } from "@/types/notification";

export type NotificationActionHandler = (
  action: NotificationAction,
  pushRequest: PushRequest,
) => void;

const handledNotificationResponseKeys = new Set<string>();

export function useNotificationStatus() {
  const fcmToken = useNotificationStore((state) => state.fcmToken);
  const isInitialized = useNotificationStore((state) => state.isInitialized);
  const isInitializing = useNotificationStore((state) => state.isInitializing);
  const permissionStatus = useNotificationStore(
    (state) => state.permissionStatus,
  );
  const pushCapability = useNotificationStore((state) => state.pushCapability);
  const registrationStatus = useNotificationStore(
    (state) => state.registrationStatus,
  );
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
  const needsPermissionRequest = isInitialized && registrationStatus === "idle";

  return {
    checkPermissions,
    fcmToken,
    getFcmToken,
    hasPermission,
    initialize,
    isInitialized,
    isInitializing,
    needsPermissionRequest,
    permissionStatus,
    pushCapability,
    registrationStatus,
    requestPermissions,
    reset,
  };
}

export function useNotifications(onAction?: NotificationActionHandler) {
  const notificationStatus = useNotificationStatus();
  const canReceivePush = notificationStatus.fcmToken !== null;
  const { pollChallenges } = useChallengePolling();

  const { addPushRequest, getPushRequestByNonce, getPushRequestById } =
    usePushRequestStore();

  const handlePushRequest = useCallback(
    async (pushRequest: PushRequest) => {
      if (await verifyIncomingPushRequest(pushRequest)) {
        addPushRequest(pushRequest);
      }
    },
    [addPushRequest],
  );

  const handleNotificationAction = useCallback(
    async (
      action: NotificationAction,
      data: NotificationResponseData,
      sentAt: number,
    ) => {
      // Try to find the push request by id or nonce
      const pushRequestId = data.pushRequestId;
      const nonce = data.nonce;

      if (!usePushRequestStore.persist.hasHydrated()) {
        await usePushRequestStore.persist.rehydrate();
      }

      const findRequest = () =>
        (pushRequestId ? getPushRequestById(pushRequestId) : undefined) ??
        (nonce ? getPushRequestByNonce(nonce) : undefined);
      let pushRequest = findRequest();

      if (!pushRequest) {
        const parsedPushRequest = parsePushRequestFromNotificationData(
          data,
          pushRequestId ?? nonce ?? `notification-${Date.now()}`,
          sentAt,
        );

        if (parsedPushRequest) {
          await handlePushRequest(parsedPushRequest);
          pushRequest = findRequest();
        } else {
          await pollChallenges();
          pushRequest = findRequest();
        }
      }

      if (!pushRequest) {
        console.warn("Could not find push request for notification action", {
          pushRequestId,
          nonce,
        });
        return;
      }

      // Call the external handler if provided
      onAction?.(action, pushRequest);
    },
    [
      getPushRequestById,
      getPushRequestByNonce,
      handlePushRequest,
      pollChallenges,
      onAction,
    ],
  );

  useEffect(() => {
    // Listen for foreground messages
    const unsubscribeMessage = canReceivePush
      ? addMessageListener(handlePushRequest)
      : () => {};

    const handleNotificationResponse = (
      response: Notifications.NotificationResponse,
    ) => {
      const action = getNotificationAction(response.actionIdentifier);
      if (!action) {
        return;
      }

      const responseKey = getNotificationResponseKey(response);
      if (handledNotificationResponseKeys.has(responseKey)) {
        return;
      }

      handledNotificationResponseKeys.add(responseKey);

      const data = getNotificationResponseData(response);
      const { date } = response.notification;
      void handleNotificationAction(
        action,
        data,
        Platform.OS === "ios" ? date * 1000 : date,
      );
    };

    // Listen for notification responses (taps and action button presses)
    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener(
        handleNotificationResponse,
      );

    // Handle notification that opened the app (when app was killed)
    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse) {
      handleNotificationResponse(lastResponse);
    }

    return () => {
      unsubscribeMessage();
      responseSubscription.remove();
    };
  }, [canReceivePush, handleNotificationAction, handlePushRequest]);

  return {
    ...notificationStatus,
  };
}
