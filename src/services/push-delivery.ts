import { PUSH_AUTHENTICATION_CATEGORY } from "@/constants/notification";
import { usePushRequestStore } from "@/stores/push-request";
import { useTokenStore } from "@/stores/token";
import type { PushRequest } from "@/types/push-request";
import { base32ToBase64 } from "@/utils/crypto";
import { buildPushRequestSignedData } from "@/utils/push-request";
import { verifyMessage } from "@/utils/rsa";
import * as Notifications from "expo-notifications";

export async function verifyIncomingPushRequest(
  request: PushRequest,
): Promise<boolean> {
  if (!useTokenStore.persist.hasHydrated()) {
    await useTokenStore.persist.rehydrate();
  }
  const getKey = () =>
    useTokenStore.getState().tokens.find(({ id }) => id === request.serial)
      ?.serverPublicKey;
  const key = getKey();
  if (!key) return false;
  try {
    const valid = await verifyMessage(
      buildPushRequestSignedData(request),
      base32ToBase64(request.signature),
      key,
    );
    return valid && getKey() === key;
  } catch {
    return false;
  }
}

export async function presentBackgroundPushRequest(
  request: PushRequest,
): Promise<void> {
  if (!(await verifyIncomingPushRequest(request))) return;
  if (!usePushRequestStore.persist.hasHydrated()) {
    await usePushRequestStore.persist.rehydrate();
  }
  if (!usePushRequestStore.getState().addPushRequest(request)) return;

  await Notifications.scheduleNotificationAsync({
    identifier: `push-auth-${request.serial}-${request.nonce}`,
    content: {
      title: request.title,
      body: request.question,
      data: { ...request, pushRequestId: request.id },
      categoryIdentifier: PUSH_AUTHENTICATION_CATEGORY,
      sound: "default",
    },
    trigger: { channelId: "push-auth" },
  });
}
