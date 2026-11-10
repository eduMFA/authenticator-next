import { useNotifications } from "@/hooks/use-notifications";
import { useToken } from "@/hooks/use-token";
import {
  findTokenForPushRequest,
  handlePushAuthRequest,
} from "@/services/push-auth";
import { usePushRequestStore } from "@/stores/push-request";
import type { PushRequest } from "@/types/push-request";
import { PushRequestStatus } from "@/types/push-request";
import { useCallback, useRef } from "react";
import { Alert } from "react-native";
import { useLingui } from "@lingui/react/macro";
import { PushRequestPopup } from "./push-request-popup";

/**
 * Component that handles push notifications and displays a popup for pending requests.
 * Supports queuing multiple requests and animates between them.
 */
export function NotificationHandler() {
  const { t } = useLingui();
  const { tokens } = useToken();
  const { pushRequests, updatePushRequestStatus } = usePushRequestStore();
  const responding = useRef(new Set<string>());

  const handleRequest = useCallback(
    async (request: PushRequest) => {
      const { getPushRequestById } = usePushRequestStore.getState();
      if (
        responding.current.has(request.id) ||
        getPushRequestById(request.id)?.status !== PushRequestStatus.Pending
      ) {
        return;
      }

      responding.current.add(request.id);
      try {
        const token = findTokenForPushRequest(request, tokens);
        const result = token && (await handlePushAuthRequest(request, token));
        if (result?.success) {
          updatePushRequestStatus(request.id, request.status);
        } else if (
          getPushRequestById(request.id)?.status === PushRequestStatus.Pending
        ) {
          updatePushRequestStatus(request.id, PushRequestStatus.Dismissed);
          Alert.alert(
            t`Response failed`,
            t`We couldn’t confirm your response. Check your connection, then start a new sign-in.`,
          );
        }
      } finally {
        responding.current.delete(request.id);
      }
    },
    [t, tokens, updatePushRequestStatus],
  );

  useNotifications(async (action, pushRequest) => {
    console.log("User action:", action, pushRequest);

    if (action === "TAP") return;

    const status =
      action === "ACCEPT"
        ? PushRequestStatus.Accepted
        : PushRequestStatus.Declined;
    await handleRequest({ ...pushRequest, status });
  });

  return <PushRequestPopup requests={pushRequests} onAction={handleRequest} />;
}
