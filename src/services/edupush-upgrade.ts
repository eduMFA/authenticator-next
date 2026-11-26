import { useTokenStore } from "@/stores/token";
import { PushTokenRolloutState, type PushToken } from "@/types/token";
import { requireDeviceAuthentication } from "@/utils/device-auth";
import {
  signEduPushV2Operation,
  type EduPushV2Operation,
} from "@/utils/edupush-v2";
import { i18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { fetch } from "expo/fetch";
import { AppState } from "react-native";

const TARGET_VERSION = 2;
const UPGRADE_RETRY_INTERVAL_MS = 5 * 60_000;
const upgradesInProgress = new Set<string>();
const lastUpgradeAttempt = new Map<string, number>();
let runningAutomaticUpgrades = false;

type UpgradeDetails = {
  push_version?: unknown;
  upgrade?: {
    target_version?: unknown;
    nonce?: unknown;
    expires_at?: unknown;
    require_device_auth?: unknown;
  };
};

export function canUpgradeEduPushToken(token: PushToken): boolean {
  const url = URL.parse(token.callbackUrl);
  return (
    (token.version ?? 1) === 1 &&
    token.rolloutState === PushTokenRolloutState.Completed &&
    Boolean(token.serverPublicKey) &&
    url?.protocol === "https:" &&
    (token.availableUpgrade === TARGET_VERSION ||
      /\/ttype\/edupush\/?$/.test(url.pathname))
  );
}

export async function upgradeEligibleEduPushTokens(): Promise<void> {
  if (runningAutomaticUpgrades) return;
  runningAutomaticUpgrades = true;
  const startedAt = Date.now();
  try {
    while (AppState.currentState === "active") {
      const token = useTokenStore.getState().tokens.find((candidate) => {
        const lastAttempt = lastUpgradeAttempt.get(candidate.id);
        return (
          (lastAttempt === undefined ||
            startedAt - lastAttempt >= UPGRADE_RETRY_INTERVAL_MS) &&
          canUpgradeEduPushToken(candidate)
        );
      });
      if (!token) return;
      try {
        await upgradeEduPushToken(token);
      } catch {
        // Older servers and temporary failures leave the token eligible for a later attempt.
      } finally {
        lastUpgradeAttempt.set(token.id, Date.now());
      }
    }
  } finally {
    runningAutomaticUpgrades = false;
  }
}

async function sendUpgradeOperation(
  token: PushToken,
  operation: Extract<EduPushV2Operation, "begin_upgrade" | "confirm_upgrade">,
  fields:
    { timestamp: string } | { nonce: string; require_device_auth: boolean },
): Promise<UpgradeDetails> {
  const signature = await signEduPushV2Operation(
    operation,
    token.id,
    TARGET_VERSION,
    ...("timestamp" in fields
      ? [fields.timestamp]
      : [fields.nonce, fields.require_device_auth]),
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(token.callbackUrl, {
      method: "POST",
      redirect: "error",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operation,
        serial: token.id,
        target_version: TARGET_VERSION,
        ...fields,
        signature,
      }),
    });
    if (!response.ok) throw new Error(`Upgrade failed: ${response.status}`);
    const body: {
      result?: { status?: boolean; value?: boolean };
      detail?: UpgradeDetails;
    } = await response.json();
    if (
      body?.result?.status !== true ||
      body.result.value !== true ||
      !body.detail
    ) {
      throw new Error("The server did not accept the upgrade request.");
    }
    return body.detail;
  } finally {
    clearTimeout(timeout);
  }
}

export async function upgradeEduPushToken(token: PushToken): Promise<void> {
  if (!canUpgradeEduPushToken(token) || upgradesInProgress.has(token.id)) {
    throw new Error("This token cannot be upgraded.");
  }
  upgradesInProgress.add(token.id);
  try {
    const getCurrentToken = () => {
      const current = useTokenStore
        .getState()
        .tokens.find(({ id }) => id === token.id);
      if (
        current?.serverPublicKey !== token.serverPublicKey ||
        current?.callbackUrl !== token.callbackUrl ||
        current?.publicKey !== token.publicKey ||
        !current ||
        (current.version ?? 1) !== 1
      ) {
        throw new Error("The token changed during the upgrade.");
      }
      return current;
    };
    const begin = await sendUpgradeOperation(token, "begin_upgrade", {
      timestamp: new Date().toISOString(),
    });
    let committed = begin;
    // A fresh begin can recover an upgrade whose confirmation response was lost.
    let requireDeviceAuth = getCurrentToken().requireDeviceAuth ?? true;
    if (begin.push_version !== TARGET_VERSION) {
      const offer = begin.upgrade;
      if (
        offer?.target_version !== TARGET_VERSION ||
        typeof offer.nonce !== "string" ||
        !offer.nonce ||
        typeof offer.expires_at !== "number" ||
        offer.expires_at * 1000 <= Date.now() ||
        typeof offer.require_device_auth !== "boolean"
      ) {
        throw new Error("The server did not return a valid upgrade offer.");
      }
      requireDeviceAuth =
        offer.require_device_auth ||
        Boolean(token.pin) ||
        getCurrentToken().requireDeviceAuth === true;
      if (requireDeviceAuth) {
        if (AppState.currentState !== "active") return;
        await requireDeviceAuthentication(
          i18n._(msg`Authenticate to upgrade your eduPush token`),
        );
      }
      getCurrentToken();
      // Persist the approval policy before the server can commit the upgrade.
      await useTokenStore
        .getState()
        .updateToken(token.id, { requireDeviceAuth });
      getCurrentToken();
      committed = await sendUpgradeOperation(token, "confirm_upgrade", {
        nonce: offer.nonce,
        require_device_auth: requireDeviceAuth,
      });
    }
    if (committed.push_version !== TARGET_VERSION) {
      throw new Error("The server did not confirm the protocol version.");
    }
    getCurrentToken();
    await useTokenStore.getState().updateToken(token.id, {
      version: TARGET_VERSION,
      sslVerify: true,
      requireDeviceAuth,
      availableUpgrade: undefined,
    });
  } finally {
    upgradesInProgress.delete(token.id);
  }
}
