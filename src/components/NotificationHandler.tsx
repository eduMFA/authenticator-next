import { useNotifications } from "@/hooks/useNotifications";
import { useToken } from "@/hooks/useToken";
import {
  findTokenForPushRequest,
  handlePushAuthRequest,
} from "@/services/pushAuthService";
import { usePushRequestStore } from "@/store/pushRequestStore";
import { PushRequest, PushRequestStatus } from "@/types";
import { useCallback } from "react";
import { PushRequestPopup } from "./PushRequestPopup";

/**
 * Component that handles push notifications and displays a popup for pending requests.
 * Supports queuing multiple requests and animates between them.
 */
export function NotificationHandler() {
  const { tokens } = useToken();
  const { pushRequests, updatePushRequestStatus } = usePushRequestStore();

  useNotifications(async (action, pushRequest) => {
    console.log("User action:", action, pushRequest);

    // Handle the user's response from notification quick actions
    if (action === "ACCEPT") {
      console.log("User accepted the push authentication");
      updatePushRequestStatus(pushRequest.id, PushRequestStatus.Accepted);
      handleRequest({ ...pushRequest, status: PushRequestStatus.Accepted });
    } else if (action === "DECLINE") {
      console.log("User declined the push authentication");
      updatePushRequestStatus(pushRequest.id, PushRequestStatus.Declined);
      handleRequest({ ...pushRequest, status: PushRequestStatus.Declined });
    } else if (action === "TAP") {
      console.log("User tapped the notification");
      // Navigate to the appropriate screen or let the popup handle it
    }
  });

  const handleRequest = useCallback(
    async (request: PushRequest): Promise<boolean> => {
      const token = findTokenForPushRequest(request, tokens);
      if (!token) {
        console.log("Token not found for push request:", request.serial);
        return false;
      }

      const result = await handlePushAuthRequest(request, token);
      return result.success;
    },
    [tokens],
  );

  return <PushRequestPopup requests={pushRequests} onAction={handleRequest} />;
}
