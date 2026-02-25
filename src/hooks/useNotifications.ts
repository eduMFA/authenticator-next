import { useNotificationStore } from "@/store/notificationStore";
import { usePushRequestStore } from "@/store/pushRequestStore";
import { PushRequest, PushRequestStatus } from "@/types";
import {
  addBackgroundMessageHandler,
  addMessageListener,
} from "@/utils/notificationService";
import { buildPushRequestSignedData } from "@/utils/pushRequestUtils";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useRef } from "react";
import { RSA } from "react-native-rsa-native";
import { useChallengePolling } from "./useChallengePolling";
import { useToken } from "./useToken";

export type NotificationAction = "ACCEPT" | "DECLINE" | "TAP";

export type NotificationActionHandler = (
  action: NotificationAction,
  pushRequest: PushRequest,
) => void;

export function useNotifications(onAction?: NotificationActionHandler) {
  const { tokens } = useToken();

  // Use the centralized notification store
  const fcmToken = useNotificationStore((state) => state.fcmToken);
  const { pollChallenges } = useChallengePolling();

  const {
    addPushRequest,
    updatePushRequestStatus,
    getPushRequestByNonce,
    getPushRequestById,
  } = usePushRequestStore();

  const handlePushRequest = useCallback(
    (pushRequest: PushRequest) => {
      console.log("Received push request:", pushRequest.id);

      const token = tokens.find((t) => t.id === pushRequest.serial);

      if (!token?.publicKey) {
        console.warn(
          "Public key not found for token serial:",
          pushRequest.serial,
        );
        return;
      }

      const signedData = buildPushRequestSignedData(pushRequest);
      if (!RSA.verify(signedData, pushRequest.signature, token.publicKey)) {
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
    async (action: NotificationAction, data: Record<string, any>) => {
      // Try to find the push request by id or nonce
      const pushRequestId = data.pushRequestId as string | undefined;
      const nonce = data.nonce as string | undefined;

      await pollChallenges();

      let pushRequest: PushRequest | undefined;

      if (pushRequestId) {
        pushRequest = getPushRequestById(pushRequestId);
      }

      if (!pushRequest && nonce) {
        pushRequest = getPushRequestByNonce(nonce);
      }

      if (!pushRequest) {
        console.warn("Could not find push request for notification action", {
          pushRequestId,
          nonce,
        });
        return;
      }

      // Update the push request status based on action
      if (action === "ACCEPT") {
        updatePushRequestStatus(pushRequest.id, PushRequestStatus.Accepted);
      } else if (action === "DECLINE") {
        updatePushRequestStatus(pushRequest.id, PushRequestStatus.Declined);
      }

      // Call the external handler if provided
      onAction?.(action, pushRequest);
    },
    [
      getPushRequestById,
      getPushRequestByNonce,
      pollChallenges,
      updatePushRequestStatus,
      onAction,
    ],
  );

  const pushRequestHandlerRef = useRef(handlePushRequest);
  const notificationActionHandlerRef = useRef(handleNotificationAction);

  useEffect(() => {
    pushRequestHandlerRef.current = handlePushRequest;
  }, [handlePushRequest]);

  useEffect(() => {
    notificationActionHandlerRef.current = handleNotificationAction;
  }, [handleNotificationAction]);

  useEffect(() => {
    // Listen for foreground messages
    const unsubscribeMessage = addMessageListener((pushRequest) => {
      pushRequestHandlerRef.current(pushRequest);
    });

    // Set up background message handler
    addBackgroundMessageHandler((pushRequest) => {
      pushRequestHandlerRef.current(pushRequest);
    });

    // Listen for notification responses (taps and action button presses)
    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const actionId = response.actionIdentifier;
        const data = (response.notification.request || {}) as Record<
          string,
          any
        >;

        console.log("Notification response received:", { actionId, data });

        if (actionId === "ACCEPT") {
          notificationActionHandlerRef.current("ACCEPT", data);
        } else if (actionId === "DECLINE") {
          notificationActionHandlerRef.current("DECLINE", data);
        } else if (actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
          // User tapped the notification itself
          notificationActionHandlerRef.current("TAP", data);
        }
      });

    // Handle notification that opened the app (when app was killed)
    const lastResponse = Notifications.getLastNotificationResponse();
    console.log("Notification response received:", { lastResponse });

    if (lastResponse) {
      const data = (lastResponse.notification.request.content.data ||
        {}) as Record<string, any>;
      const actionId = lastResponse.actionIdentifier;

      if (actionId === "ACCEPT") {
        notificationActionHandlerRef.current("ACCEPT", data);
      } else if (actionId === "DECLINE") {
        notificationActionHandlerRef.current("DECLINE", data);
      } else {
        notificationActionHandlerRef.current("TAP", data);
      }
    }

    return () => {
      unsubscribeMessage();
      responseSubscription.remove();
    };
  }, []);

  return {
    fcmToken,
  };
}
