import type { PushRequest } from "@/types/push-request";
import { PushRequestStatus } from "@/types/push-request";
import type { PushToken } from "@/types/token";
import { validatePushRequestData } from "@/utils/notification";
import { type NativeModule, requireNativeModule } from "expo";

declare class NativeNotificationsModule extends NativeModule<{
  onActionCompleted: () => void;
}> {
  synchronize(json: string): Promise<string>;
  submit(json: string, action: "ACCEPT" | "DECLINE"): Promise<boolean>;
}

function nativeNotifications() {
  return requireNativeModule<NativeNotificationsModule>("EduMfaNotifications");
}

export async function synchronizeNativeNotifications(
  tokens: PushToken[],
  requests: PushRequest[],
): Promise<PushRequest[]> {
  const json = await nativeNotifications().synchronize(
    JSON.stringify({
      tokens: tokens
        .filter((token) => token.serverPublicKey)
        .map(({ id, callbackUrl, serverPublicKey }) => ({
          id,
          callbackUrl,
          serverPublicKey,
        })),
      requests,
    }),
  );
  const results: unknown = JSON.parse(json);
  if (!Array.isArray(results))
    throw new Error("Invalid native notification results");
  return results.filter((result: unknown): result is PushRequest => {
    if (!validatePushRequestData(result)) return false;
    const metadata = result as Record<string, unknown>;
    return (
      typeof metadata.id === "string" &&
      typeof metadata.sentAt === "number" &&
      Number.isFinite(metadata.sentAt) &&
      Object.values(PushRequestStatus).includes(
        metadata.status as PushRequestStatus,
      )
    );
  });
}

export function submitNativeNotification(
  request: PushRequest,
): Promise<boolean> {
  return nativeNotifications().submit(
    JSON.stringify(request),
    request.status === PushRequestStatus.Declined ? "DECLINE" : "ACCEPT",
  );
}

export function addNativeNotificationListener(handler: () => void): () => void {
  const subscription = nativeNotifications().addListener(
    "onActionCompleted",
    handler,
  );
  return () => subscription.remove();
}
