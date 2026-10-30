import { SIGN_ALGORITHM } from "@/constants/auth";
import type { PushToken } from "@/types/token";
import { PushTokenRolloutState } from "@/types/token";
import type { RolloutStateUpdater, TokenGetter } from "@/types/token-rollout";
import { base64ToBase32 } from "@/utils/crypto";
import { signMessage } from "@/utils/rsa";

// Serialize updates per token so an older FCM destination cannot win a race.
const registrations = new Map<string, Promise<void>>();

async function register(
  token: PushToken,
  fcmToken: string,
  isCurrent: () => boolean,
): Promise<boolean> {
  const timestamp = new Date().toISOString();
  const signature = base64ToBase32(
    await signMessage(
      `${fcmToken}|${token.id}|${timestamp}`,
      token.id,
      SIGN_ALGORITHM,
    ),
  );
  if (!isCurrent()) return false;
  const response = await fetch(token.callbackUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serial: token.id,
      new_fb_token: fcmToken,
      timestamp,
      signature,
    }),
  });
  if (!response.ok) throw new Error(`FCM update failed: ${response.status}`);
  const body: { result?: { status?: boolean; value?: boolean } } =
    await response.json();
  if (body.result?.status !== true || body.result.value !== true) {
    throw new Error("The server did not accept the FCM update.");
  }
  return true;
}

export async function syncFcmRegistration(
  getTokens: TokenGetter,
  fcmToken: string | null,
  updateState: RolloutStateUpdater,
  isCurrent: () => boolean = () => true,
): Promise<void> {
  // Do not erase an existing destination when Firebase is temporarily unavailable.
  if (!fcmToken) return;
  await Promise.all(
    getTokens().map(async ({ id }) => {
      const previous = registrations.get(id) ?? Promise.resolve();
      const pending = previous
        .catch(() => {})
        .then(async () => {
          const token = getTokens().find((candidate) => candidate.id === id);
          if (
            !isCurrent() ||
            !token ||
            token.rolloutState !== PushTokenRolloutState.Completed ||
            token.registeredFcmToken === fcmToken
          )
            return;
          const registered = await register(token, fcmToken, isCurrent);
          if (
            registered &&
            getTokens().some((candidate) => candidate.id === id)
          ) {
            updateState(id, { registeredFcmToken: fcmToken });
          }
        });
      registrations.set(id, pending);
      try {
        await pending;
      } catch (error) {
        console.warn(
          `Could not update Firebase registration for ${id}; will retry on refresh.`,
          error,
        );
      } finally {
        if (registrations.get(id) === pending) registrations.delete(id);
      }
    }),
  );
}
