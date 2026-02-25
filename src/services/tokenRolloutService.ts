import { KEY_SIZE } from "@/consts";
import { useNotificationStore } from "@/store/notificationStore";
import { PushToken, PushTokenRolloutState } from "@/types";
import { parseTokenResponse, stripPemArmor } from "@/utils/tokenUtils";
import { RSAKeychain } from "react-native-rsa-native";

// Map rollout states to their corresponding failed states
const ROLLOUT_STATE_TO_FAILED_STATE: Partial<
  Record<PushTokenRolloutState, PushTokenRolloutState>
> = {
  [PushTokenRolloutState.RSAKeyGeneration]:
    PushTokenRolloutState.RSAKeyGenerationFailed,
  [PushTokenRolloutState.SendRSAPublicKey]:
    PushTokenRolloutState.SendRSAPublicKeyFailed,
  [PushTokenRolloutState.ParsingResponse]:
    PushTokenRolloutState.ParsingResponseFailed,
};

// Track tokens currently being rolled out
const rollingOutTokens = new Set<string>();

export type RolloutStateUpdater = (
  id: string,
  update: Partial<PushToken>,
) => void;

export type TokenGetter = () => PushToken[];

/**
 * Check if a token is currently being rolled out
 */
export function isTokenRollingOut(id: string): boolean {
  return rollingOutTokens.has(id);
}

/**
 * Generate RSA key pair for a token
 */
async function generateRSAKeys(tokenId: string): Promise<string> {
  const { public: pubkey } = await RSAKeychain.generateKeys(tokenId, KEY_SIZE);
  console.log(`Generated RSA keys for token ${tokenId}. Public key:`, pubkey);
  return pubkey;
}

/**
 * Send public key to server during token rollout
 */
async function sendPublicKeyToServer(
  token: PushToken,
  publicKey: string,
  fcmToken: string,
): Promise<Response> {
  console.log(
    `Sending public key to server for token ${token.id} at ${token.callbackUrl} with payload:`,
    {
      enrollment_credential: token.enrollmentCredential,
      serial: token.id,
      fbtoken: fcmToken,
      pubkey: publicKey,
    },
  );

  const response = await fetch(token.callbackUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      enrollment_credential: token.enrollmentCredential,
      serial: token.id,
      fbtoken: fcmToken,
      pubkey: stripPemArmor(publicKey),
    }),
  });

  return response;
}

export interface RolloutResult {
  success: boolean;
  serverPublicKey?: string;
  error?: Error;
  failedState?: PushTokenRolloutState;
}

/**
 * Perform the token rollout process
 * This is the core rollout logic extracted from the store
 */
export async function performTokenRollout(
  token: PushToken,
  updateState: RolloutStateUpdater,
): Promise<RolloutResult> {
  const { id } = token;

  // Skip if already rolling out
  if (rollingOutTokens.has(id)) {
    console.log(`Token ${id} is already being rolled out, skipping`);
    return { success: false, error: new Error("Already rolling out") };
  }

  // Skip if already completed or in failed state
  if (
    token.rolloutState === PushTokenRolloutState.Completed ||
    PushTokenRolloutState.isFailed(token.rolloutState)
  ) {
    return { success: false, error: new Error("Token already processed") };
  }

  // Mark as rolling out
  rollingOutTokens.add(id);

  // Track current step for proper error state mapping
  let currentStep: PushTokenRolloutState = PushTokenRolloutState.Pending;

  try {
    // Step 1: Generate RSA key pair
    currentStep = PushTokenRolloutState.RSAKeyGeneration;
    updateState(id, { rolloutState: currentStep });
    const pubkey = await generateRSAKeys(id);

    // Step 2: Send public key to server
    currentStep = PushTokenRolloutState.SendRSAPublicKey;
    updateState(id, {
      rolloutState: currentStep,
      publicKey: pubkey,
    });

    // Step 3: Get FCM token from the centralized notification store
    const fbToken = await useNotificationStore.getState().getFcmToken();
    if (!fbToken) {
      throw new Error("Failed to retrieve FCM token");
    }
    console.log(`Retrieved FCM token for token ${id}: ${fbToken}`);

    const response = await sendPublicKeyToServer(token, pubkey, fbToken);

    if (!response.ok) {
      console.error(
        `Server responded with status ${response.status} for token ${id}: ${await response.text()}`,
      );
      updateState(id, {
        rolloutState: PushTokenRolloutState.SendRSAPublicKeyFailed,
      });
      return {
        success: false,
        failedState: PushTokenRolloutState.SendRSAPublicKeyFailed,
      };
    }

    console.log(`Sent public key to server for token ${id}`);

    // Step 4: Parse server response
    currentStep = PushTokenRolloutState.ParsingResponse;
    updateState(id, { rolloutState: currentStep });

    const serverPublicKey = await parseTokenResponse(response);
    updateState(id, {
      rolloutState: PushTokenRolloutState.Completed,
      serverPublicKey,
    });

    return { success: true, serverPublicKey };
  } catch (error) {
    console.error(`Rollout failed for token ${id}:`, error);

    // Determine the failed state based on current rollout step
    const failedState = ROLLOUT_STATE_TO_FAILED_STATE[currentStep];

    if (failedState) {
      updateState(id, { rolloutState: failedState });
    }

    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      failedState,
    };
  } finally {
    // Always remove from rolling out set
    rollingOutTokens.delete(id);
  }
}

/**
 * Start rollout for all tokens that need it
 */
export function startPendingRollouts(
  getTokens: TokenGetter,
  updateState: RolloutStateUpdater,
): void {
  const tokens = getTokens();

  const tokensNeedingRollout = tokens.filter(
    (token) =>
      PushTokenRolloutState.needsRollout(token.rolloutState) &&
      !rollingOutTokens.has(token.id),
  );

  console.log(`Starting rollout for ${tokensNeedingRollout.length} tokens`);

  for (const token of tokensNeedingRollout) {
    performTokenRollout(token, updateState).catch((error) => {
      console.error(`Auto-rollout failed for token ${token.id}:`, error);
    });
  }
}

/**
 * Delete the private key associated with a token
 */
export async function deleteTokenPrivateKey(tokenId: string): Promise<void> {
  try {
    await RSAKeychain.deletePrivateKey(tokenId);
  } catch (error) {
    console.error(`Failed to delete private key for token ${tokenId}:`, error);
    throw error;
  }
}
