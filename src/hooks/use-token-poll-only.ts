import { useNotificationStore } from "@/stores/notification";
import type { PushToken } from "@/types/token";
import { isTokenPollOnly } from "@/utils/token-delivery";

/** Effective delivery on this device; the server's delivery mode is not exposed. */
export function useTokenPollOnly(token: PushToken): boolean {
  const capability = useNotificationStore((state) => state.pushCapability);
  return isTokenPollOnly(token, capability);
}
