import { SIGN_ALGORITHM } from "@/consts";
import { PushRequest, PushRequestStatus, PushToken } from "@/types";
import { base32, base64 } from "@scure/base";
import * as Haptics from "expo-haptics";
import { RSAKeychain } from "react-native-rsa-native";

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
  const signatureBase64 = await RSAKeychain.signWithAlgorithm(
    message,
    tokenId,
    SIGN_ALGORITHM,
  );
  console.log("Generated Base 64 signature:", signatureBase64);
  // Convert base64 signature to base32 as required by the API
  const signature = base32.encode(base64.decode(signatureBase64));
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
  _sslVerify: boolean = true,
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
    // Build and sign the message
    const message = buildSignatureMessage(
      request.nonce,
      request.serial,
      isDeclined,
    );
    console.log("Signing message:", message);

    const signature = await signPushAuthMessage(message, token.id);

    // Send to server
    const response = await sendPushAuthToServer(
      token.callbackUrl,
      request.nonce,
      token.id,
      signature,
      isDeclined,
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

    // Provide haptic feedback
    Haptics.notificationAsync(
      isDeclined
        ? Haptics.NotificationFeedbackType.Warning
        : Haptics.NotificationFeedbackType.Success,
    );

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
