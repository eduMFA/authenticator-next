import { useNotificationStore } from "@/store/notification-store";
import { usePushRequestStore } from "@/store/push-request-store";
import type { PushRequest } from "@/types";
import { base32ToBase64 } from "@/utils/crypto";
import type {
  NotificationAction,
  NotificationResponseData,
} from "@/utils/notification";
import {
  addBackgroundMessageHandler,
  addMessageListener,
  getNotificationAction,
  getNotificationResponseData,
  getNotificationResponseKey,
  isNotificationPermissionEnabled,
  parsePushRequestFromNotificationData,
} from "@/utils/notification";
import { buildPushRequestSignedData } from "@/utils/push-request";
import { verifyMessage } from "@/utils/rsa";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect } from "react";
import { useChallengePolling } from "./use-challenge-polling";
import { useToken } from "./use-token";

export type { NotificationAction } from "@/utils/notification";

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
    requestPermissions,
    reset,
  };
}

export function useNotifications(onAction?: NotificationActionHandler) {
  const { tokens } = useToken();
  const notificationStatus = useNotificationStatus();
  const { pollChallenges } = useChallengePolling();

  const { addPushRequest, getPushRequestByNonce, getPushRequestById } =
    usePushRequestStore();

  const handlePushRequest = useCallback(
    async (pushRequest: PushRequest) => {
      console.log("Received push request:", pushRequest.id);

      const token = tokens.find((t) => t.id === pushRequest.serial);

      if (!token?.serverPublicKey) {
        console.warn(
          "Server public key not found for token serial:",
          pushRequest.serial,
        );
        return;
      }

      const signedData = buildPushRequestSignedData(pushRequest);
      let isValid = false;
      try {
        isValid = await verifyMessage(
          signedData,
          base32ToBase64(pushRequest.signature),
          token.serverPublicKey,
        );
      } catch (error) {
        console.error("Error verifying push request signature:", error);
        return;
      }

      if (!isValid) {
        console.warn(
          "Signature verification failed for push request:",
          pushRequest.id,
        );
        return;
      }

      addPushRequest(pushRequest);
    },
    [addPushRequest, tokens],
  );

  const handleNotificationAction = useCallback(
    async (action: NotificationAction, data: NotificationResponseData) => {
      // Try to find the push request by id or nonce
      const pushRequestId = data.pushRequestId;
      const nonce = data.nonce;

      await pollChallenges();

      let pushRequest: PushRequest | undefined;

      if (pushRequestId) {
        pushRequest = getPushRequestById(pushRequestId);
      }

      if (!pushRequest && nonce) {
        pushRequest = getPushRequestByNonce(nonce);
      }

      if (!pushRequest) {
        const parsedPushRequest = parsePushRequestFromNotificationData(
          data,
          pushRequestId ?? nonce ?? `notification-${Date.now()}`,
        );

        if (parsedPushRequest) {
          await handlePushRequest(parsedPushRequest);
          pushRequest = getPushRequestByNonce(parsedPushRequest.nonce);
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
    const unsubscribeMessage = addMessageListener((pushRequest) => {
      void handlePushRequest(pushRequest);
    });

    // Set up background message handler
    addBackgroundMessageHandler((pushRequest) => {
      void handlePushRequest(pushRequest);
    });

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
      console.debug("Notification response received:", { action, data });
      void handleNotificationAction(action, data);
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
  }, [handleNotificationAction, handlePushRequest]);

  return {
    ...notificationStatus,
  };
}
