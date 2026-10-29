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

export interface PushAuthResponse {
  success: boolean;
  challengeMatched?: boolean;
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
 * Format: {nonce}|{serial}[|decline or |{challenge_type}|{challenge_response}]
 */
function buildSignatureMessage(
  nonce: string,
  serial: string,
  isDeclined: boolean,
  challengeResponse?: string,
  challengeType?: string,
): string {
  let msg = `${nonce}|${serial}`;
  if (isDeclined) {
    msg += "|decline";
  } else if (challengeResponse !== undefined) {
    msg += `|${challengeType}|${challengeResponse}`;
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
  _sslVerify: boolean = true,
  challengeResponse?: string,
): Promise<Response> {
  // TODO: Implement SSL verification toggle based on token settings
  const response = await fetch(callbackUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nonce,
      serial,
      signature,
      decline: isDeclined ? 1 : 0,
      ...(challengeResponse !== undefined
        ? { challenge_response: challengeResponse }
        : {}),
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

  try {
    if (
      !isDeclined &&
      request.challenge_type &&
      (!request.challenge_response ||
        !request.challenge_choices
          ?.split(",")
          .includes(request.challenge_response))
    ) {
      return {
        success: false,
        error: new Error("Complete the challenge before approving."),
      };
    }
    // Build and sign the message
    const message = buildSignatureMessage(
      request.nonce,
      request.serial,
      isDeclined,
      request.challenge_type ? request.challenge_response : undefined,
      request.challenge_type,
    );
    console.debug("Signing message:", message);

    const signature = await signPushAuthMessage(message, token.id);

    // Send to server
    const response = await sendPushAuthToServer(
      token.callbackUrl,
      request.nonce,
      token.id,
      signature,
      isDeclined,
      token.sslVerify,
      !isDeclined && request.challenge_choices
        ? request.challenge_response
        : undefined,
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

    const body: {
      result?: { status?: boolean; value?: boolean };
      detail?: { challenge_status?: string };
    } = await response.json();
    if (body.result?.status !== true || body.result.value !== true) {
      const mismatch = body.detail?.challenge_status === "challenge_mismatch";
      playNotificationWarningHaptic();
      return {
        success: false,
        ...(mismatch ? { challengeMatched: false } : {}),
        error: new Error(
          mismatch
            ? "The challenge response did not match. Sign in again."
            : "The server did not accept this response.",
        ),
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
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
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
