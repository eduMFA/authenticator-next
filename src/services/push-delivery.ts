import { PUSH_AUTHENTICATION_CATEGORY } from "@/constants/notification";
import { usePushRequestStore } from "@/stores/push-request";
import { useTokenStore } from "@/stores/token";
import type { PushRequest } from "@/types/push-request";
import { base32ToBase64 } from "@/utils/crypto";
import {
  buildPushRequestSignedData,
  getPushNotificationContent,
} from "@/utils/push-request";
import { verifyMessage } from "@/utils/rsa";
import * as Notifications from "expo-notifications";

export async function verifyIncomingPushRequest(
  request: PushRequest,
): Promise<boolean> {
  if (!useTokenStore.persist.hasHydrated()) {
    await useTokenStore.persist.rehydrate();
  }
  const getToken = () =>
    useTokenStore.getState().tokens.find(({ id }) => id === request.serial);
  const token = getToken();
  if (!token?.serverPublicKey) return false;
  const signedData = buildPushRequestSignedData(request, token.version);
  if (signedData === null) return false;
  try {
    const valid = await verifyMessage(
      signedData,
      base32ToBase64(request.signature),
      token.serverPublicKey,
    );
    const current = getToken();
    return (
      valid &&
      current?.serverPublicKey === token.serverPublicKey &&
      current.version === token.version
    );
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

  const token = useTokenStore
    .getState()
    .tokens.find(({ id }) => id === request.serial);
  await Notifications.scheduleNotificationAsync({
    identifier: `push-auth-${request.serial}-${request.nonce}`,
    content: {
      ...getPushNotificationContent(request, token),
      categoryIdentifier: PUSH_AUTHENTICATION_CATEGORY,
      sound: "default",
    },
    trigger: { channelId: "push-auth" },
  });
}
