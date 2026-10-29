import { useNotifications } from "@/hooks/use-notifications";
import { useToken } from "@/hooks/use-token";
import {
  findTokenForPushRequest,
  handlePushAuthRequest,
  type PushAuthResponse,
} from "@/services/push-auth";
import { usePushRequestStore } from "@/stores/push-request";
import type { PushRequest } from "@/types/push-request";
import { PushRequestStatus } from "@/types/push-request";
import { useCallback } from "react";
import { PushRequestPopup } from "./push-request-popup";

/**
 * Component that handles push notifications and displays a popup for pending requests.
 * Supports queuing multiple requests and animates between them.
 */
export function NotificationHandler() {
  const { tokens } = useToken();
  const { pushRequests, updatePushRequestStatus } = usePushRequestStore();

  const handleRequest = useCallback(
    async (request: PushRequest): Promise<PushAuthResponse> => {
      if (
        __DEV__ &&
        request.id.startsWith("sample-push-request-") &&
        request.signature === "sample-signature"
      ) {
        if (
          request.status === PushRequestStatus.Declined ||
          !request.challenge_choices
        )
          return { success: true };
        return {
          success: request.challenge_response === "42",
          challengeMatched: request.challenge_response === "42",
        };
      }
      const token = findTokenForPushRequest(request, tokens);
      if (!token) {
        console.log("Token not found for push request:", request.serial);
        return { success: false };
      }

      const result = await handlePushAuthRequest(request, token);
      return result;
    },
    [tokens],
  );

  useNotifications(async (action, pushRequest) => {
    console.log("User action:", action, pushRequest);

    // Handle the user's response from notification quick actions
    if (action === "ACCEPT" && !pushRequest.challenge_choices) {
      console.log("User accepted the push authentication");
      updatePushRequestStatus(pushRequest.id, PushRequestStatus.Accepted);
      void handleRequest({
        ...pushRequest,
        status: PushRequestStatus.Accepted,
      });
    } else if (action === "DECLINE") {
      console.log("User declined the push authentication");
      updatePushRequestStatus(pushRequest.id, PushRequestStatus.Declined);
      void handleRequest({
        ...pushRequest,
        status: PushRequestStatus.Declined,
      });
    } else if (action === "TAP") {
      console.log("User tapped the notification");
      // Navigate to the appropriate screen or let the popup handle it
    }
  });

  return <PushRequestPopup requests={pushRequests} onAction={handleRequest} />;
}
