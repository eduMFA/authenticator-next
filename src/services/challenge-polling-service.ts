import { SIGN_ALGORITHM } from "@/constants/auth";
import {
  PushRequest,
  PushRequestStatus,
  PushToken,
  PushTokenRolloutState,
} from "@/types";
import { base32ToBase64, base64ToBase32 } from "@/utils/crypto";
import { buildPushRequestSignedData } from "@/utils/push-request-utils";
import { signMessage, verifyMessage } from "@/utils/rsa";

export interface ChallengePollingResult {
  success: boolean;
  challenges: PushRequest[];
  tokenResults?: TokenChallengePollingResult[];
  error?: Error;
}

export interface TokenChallengePollingResult {
  tokenId: string;
  success: boolean;
  error?: Error;
}

export class ChallengePollingNetworkError extends Error {
  constructor(cause: Error) {
    super(cause.message, { cause });
    this.name = "ChallengePollingNetworkError";
  }
}

export class ChallengePollingServerError extends Error {
  constructor(
    public readonly status: number,
    public readonly responseBody: string,
  ) {
    super(`Server returned ${status}: ${responseBody}`);
    this.name = "ChallengePollingServerError";
  }
}

interface ChallengeResponse {
  nonce: string;
  question: string;
  serial: string;
  signature: string;
  sslverify: string;
  title: string;
  url: string;
}

/**
 * Generate an ISO 8601 timestamp for the polling request
 */
function generateTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Sign the polling message with the token's private key
 * Message format: {serial}|{timestamp}
 */
async function signPollingMessage(
  serial: string,
  timestamp: string,
  tokenId: string,
): Promise<string> {
  const message = `${serial}|${timestamp}`;
  const signatureBase64 = await signMessage(message, tokenId, SIGN_ALGORITHM);
  // Convert base64 signature to base32 as required by the API
  const signature = base64ToBase32(signatureBase64);
  return signature;
}

/**
 * Parse challenge response from server into PushRequest
 */
async function parseChallengeResponse(
  data: ChallengeResponse,
  token: PushToken,
): Promise<PushRequest | null> {
  // Verify the signature from the server using the token's server public key
  if (token.serverPublicKey) {
    const signedData = buildPushRequestSignedData(data);
    try {
      const isValid = await verifyMessage(
        signedData,
        base32ToBase64(data.signature),
        token.serverPublicKey,
      );
      if (!isValid) {
        console.warn("Signature verification failed for polled challenge");
        return null;
      }
    } catch (error) {
      console.error("Error verifying challenge signature:", error);
      return null;
    }
  }

  return {
    id: `poll-${data.nonce}-${Date.now()}`,
    status: PushRequestStatus.Pending,
    sentAt: Date.now(),
    nonce: data.nonce,
    question: data.question,
    serial: data.serial,
    signature: data.signature,
    sslverify: data.sslverify,
    title: data.title,
    url: data.url,
  };
}

/**
 * Poll for new challenges for a single token
 */
export async function pollChallengesForToken(
  token: PushToken,
): Promise<ChallengePollingResult> {
  try {
    const timestamp = generateTimestamp();
    const signature = await signPollingMessage(token.id, timestamp, token.id);

    // Build the polling URL with query parameters
    const url = new URL(token.callbackUrl);
    url.searchParams.set("serial", token.id);
    url.searchParams.set("timestamp", timestamp);
    url.searchParams.set("signature", signature);

    console.log(`Polling challenges for token ${token.id}.`);

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });
    } catch (error) {
      console.error(`Network error polling token ${token.id}:`, error);
      return {
        success: false,
        challenges: [],
        error: new ChallengePollingNetworkError(
          error instanceof Error ? error : new Error(String(error)),
        ),
      };
    }

    if (response.status === 204 || response.status === 404) {
      // No challenges available
      return { success: true, challenges: [] };
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Polling failed for token ${token.id}:`,
        response.status,
        errorText,
      );
      return {
        success: false,
        challenges: [],
        error: new ChallengePollingServerError(response.status, errorText),
      };
    }

    const data = await response.json();

    const challenges: PushRequest[] = [];
    for (const challengeData of data?.result?.value || []) {
      const pushRequest = await parseChallengeResponse(challengeData, token);
      if (pushRequest) {
        challenges.push(pushRequest);
      }
    }

    console.log(`Found ${challenges.length} challenges for token ${token.id}`);
    return { success: true, challenges };
  } catch (error) {
    console.error(`Error polling challenges for token ${token.id}:`, error);
    return {
      success: false,
      challenges: [],
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Poll for new challenges for all completed tokens
 */
export async function pollAllChallenges(
  tokens: PushToken[],
): Promise<ChallengePollingResult> {
  // Only poll for tokens that have completed rollout
  const completedTokens = tokens.filter(
    (t) => t.rolloutState === PushTokenRolloutState.Completed,
  );

  if (completedTokens.length === 0) {
    return { success: true, challenges: [], tokenResults: [] };
  }

  console.log(`Polling challenges for ${completedTokens.length} tokens`);

  const allChallenges: PushRequest[] = [];
  const errors: Error[] = [];
  const tokenResults: TokenChallengePollingResult[] = [];

  // Poll all tokens in parallel
  const results = await Promise.allSettled(
    completedTokens.map((token) => pollChallengesForToken(token)),
  );

  for (const [index, result] of results.entries()) {
    const token = completedTokens[index];

    if (result.status === "fulfilled") {
      allChallenges.push(...result.value.challenges);
      if (result.value.error) {
        errors.push(result.value.error);
      }
      tokenResults.push({
        tokenId: token.id,
        success: result.value.success,
        error: result.value.error,
      });
    } else {
      const error =
        result.reason instanceof Error
          ? result.reason
          : new Error(String(result.reason));
      errors.push(error);
      tokenResults.push({
        tokenId: token.id,
        success: false,
        error,
      });
    }
  }

  return {
    success: errors.length === 0,
    challenges: allChallenges,
    tokenResults,
    error:
      errors.length > 0
        ? new Error(`${errors.length} token(s) failed to poll`)
        : undefined,
  };
}
