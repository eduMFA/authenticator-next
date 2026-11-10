import { SIGN_ALGORITHM } from "@/constants/auth";
import type { PushRequest } from "@/types/push-request";
import { PushRequestStatus } from "@/types/push-request";
import type { PushToken } from "@/types/token";
import { base64ToBase32 } from "@/utils/crypto";
import {
  playNotificationSuccessHaptic,
  playNotificationWarningHaptic,
} from "@/utils/haptics";
import { signMessage } from "@/utils/rsa";

const responding = new Set<string>();
const PUSH_RESPONSE_TIMEOUT_MS = 10_000;

export interface PushAuthResponse {
  success: boolean;
  error?: Error;
}

/**
 * Sign a push authentication message with the token's private key
 */
async function signPushAuthMessage(
  message: string,
  tokenId: string,
): Promise<string> {
  const signatureBase64 = await signMessage(message, tokenId, SIGN_ALGORITHM);
  console.debug("Generated Base 64 signature:", signatureBase64);
  // Convert base64 signature to base32 as required by the API
  const signature = base64ToBase32(signatureBase64);
  return signature;
}

/**
 * Build the message to sign for push authentication
 * Format: {nonce}|{serial}[|decline]
 */
function buildSignatureMessage(
  nonce: string,
  serial: string,
  isDeclined: boolean,
): string {
  let msg = `${nonce}|${serial}`;
  if (isDeclined) {
    msg += "|decline";
  }
  return msg;
}

/**
 * Send the push authentication response to the server
 */
async function sendPushAuthToServer(
  callbackUrl: string,
  nonce: string,
  serial: string,
  signature: string,
  isDeclined: boolean,
  signal: AbortSignal,
  _sslVerify: boolean = true,
): Promise<Response> {
  // TODO: Implement SSL verification toggle based on token settings
  const response = await fetch(callbackUrl, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nonce,
      serial,
      signature,
      decline: isDeclined ? 1 : 0,
    }),
  });

  return response;
}

/**
 * Handle a push authentication request by signing and sending the response
 */
export async function handlePushAuthRequest(
  request: PushRequest,
  token: PushToken,
): Promise<PushAuthResponse> {
  const isDeclined = request.status === PushRequestStatus.Declined;
  const responseId = `${token.id}|${request.nonce}`;
  if (request.serial !== token.id || responding.has(responseId)) {
    return {
      success: false,
      error: new Error("Invalid or duplicate response."),
    };
  }
  responding.add(responseId);

  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    // Build and sign the message
    const message = buildSignatureMessage(
      request.nonce,
      request.serial,
      isDeclined,
    );
    console.debug("Signing message:", message);

    const signature = await signPushAuthMessage(message, token.id);

    // Send to server
    timeout = setTimeout(() => controller.abort(), PUSH_RESPONSE_TIMEOUT_MS);
    const response = await sendPushAuthToServer(
      token.callbackUrl,
      request.nonce,
      token.id,
      signature,
      isDeclined,
      controller.signal,
      token.sslVerify,
    );

    if (response.status !== 200) {
      console.log(
        "Sending push response failed:",
        response.status,
        await response.text(),
      );
      return {
        success: false,
        error: new Error(`Server returned ${response.status}`),
      };
    }

    const body: { result?: { status?: boolean; value?: boolean } } =
      await response.json();
    if (body.result?.status !== true || body.result.value !== true) {
      return {
        success: false,
        error: new Error("The server did not accept this response."),
      };
    }

    // Provide haptic feedback
    if (isDeclined) {
      playNotificationWarningHaptic();
    } else {
      playNotificationSuccessHaptic();
    }

    return { success: true };
  } catch (error) {
    console.error("Push auth handling failed:", error);
    if (controller.signal.aborted) {
      return {
        success: false,
        error: new Error("The server did not respond in time."),
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  } finally {
    clearTimeout(timeout);
    responding.delete(responseId);
  }
}

/**
 * Find the token associated with a push request
 */
export function findTokenForPushRequest(
  request: PushRequest,
  tokens: PushToken[],
): PushToken | undefined {
  return tokens.find((t) => t.id === request.serial);
}
