import type { PushNotificationCapability } from "@/types/notification";
import { PushTokenRolloutState, type PushToken } from "@/types/token";

export function isTokenPollOnly(
  token: PushToken,
  capability: PushNotificationCapability | null,
): boolean {
  return (
    token.rolloutState === PushTokenRolloutState.Completed &&
    capability === "google-play-services-unavailable"
  );
}
