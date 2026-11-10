import { useNotificationStore } from "@/stores/notification";
import { usePushRequestStore } from "@/stores/push-request";
import { useTokenStore } from "@/stores/token";
import type {
  NotificationAction,
  NotificationResponseData,
} from "@/types/notification";
import type { PushRequest } from "@/types/push-request";
import { base32ToBase64 } from "@/utils/crypto";
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
      console.log("Received push request:", pushRequest.id);

      const token = useTokenStore
        .getState()
        .tokens.find((t) => t.id === pushRequest.serial);

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

      const currentToken = useTokenStore
        .getState()
        .tokens.find((t) => t.id === pushRequest.serial);
      if (currentToken?.serverPublicKey === token.serverPublicKey) {
        addPushRequest(pushRequest);
      }
    },
    [addPushRequest],
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
    const unsubscribeMessage = canReceivePush
      ? addMessageListener((pushRequest) => {
          void handlePushRequest(pushRequest);
        })
      : () => {};

    // Set up background message handler
    if (canReceivePush) {
      addBackgroundMessageHandler((pushRequest) => {
        void handlePushRequest(pushRequest);
      });
    }

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
  }, [canReceivePush, handleNotificationAction, handlePushRequest]);

  return {
    ...notificationStatus,
  };
}
