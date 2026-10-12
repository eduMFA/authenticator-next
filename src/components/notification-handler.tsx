import { useNotifications } from "@/hooks/use-notifications";
import { submitPushRequest } from "@/services/push-notification";
import { usePushRequestStore } from "@/stores/push-request";
import { PushRequestPopup } from "./push-request-popup";

/** Handles notification actions and displays pending authentication requests. */
export function NotificationHandler() {
  const pushRequests = usePushRequestStore((state) => state.pushRequests);
  useNotifications();
  return (
    <PushRequestPopup requests={pushRequests} onAction={submitPushRequest} />
  );
}
