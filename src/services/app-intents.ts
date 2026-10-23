import { useTokenStore } from "@/stores/token";
import { PUSH_REQUEST_MAX_AGE_MS } from "@/constants/push-request";
import { handlePushAuthRequest } from "@/services/push-auth";
import { usePushRequestStore } from "@/stores/push-request";
import type { PushRequest } from "@/types/push-request";
import { PushRequestStatus } from "@/types/push-request";
import type { PushToken } from "@/types/token";
import { PushTokenRolloutState } from "@/types/token";
import * as AppIntents from "expo-app-intents";
import { router } from "expo-router";

// Serialize replacements so an older publication cannot overwrite a rename or deletion.
let catalogQueue: Promise<void> = Promise.resolve();

export function publishChallengeCatalog(
  requests: PushRequest[],
  tokens: PushToken[],
): Promise<void> {
  const catalog = requests.flatMap((request) => {
    const token = tokens.find((item) => item.id === request.serial);
    if (
      !token ||
      request.status !== PushRequestStatus.Pending ||
      request.sentAt + PUSH_REQUEST_MAX_AGE_MS <= Date.now()
    )
      return [];
    return [
      {
        id: request.id,
        title: request.title.trim() || token.label.trim() || token.id,
        subtitle: [token.label, request.question].filter(Boolean).join(" · "),
        metadata: {
          expiresAt: String(request.sentAt + PUSH_REQUEST_MAX_AGE_MS),
        },
        hideInSpotlight: true,
      },
    ];
  });
  const publication = catalogQueue.then(() =>
    AppIntents.setEntityCatalogAsync("pushChallenge", catalog),
  );
  catalogQueue = publication.catch(() => {});
  return publication;
}

class InvalidChallengeIntentError extends Error {}

async function respondToChallenge(
  invocation: AppIntents.AppIntentInvocation,
): Promise<void> {
  const { requestId, approve } = invocation.params;
  if (
    typeof requestId !== "string" ||
    !requestId ||
    typeof approve !== "boolean"
  ) {
    throw new InvalidChallengeIntentError(
      "The shortcut must specify a sign-in request and an approval or denial.",
    );
  }
  const store = usePushRequestStore.getState();
  const previous = store.intentResponses[invocation.id];
  const status = approve
    ? PushRequestStatus.Accepted
    : PushRequestStatus.Declined;
  if (previous) {
    if (previous.requestId !== requestId || previous.approve !== approve) {
      throw new InvalidChallengeIntentError(
        "The shortcut invocation has conflicting response parameters.",
      );
    }
    if (previous.state === "completed") {
      // Retry the durable write too: a previous write may have failed after updating memory.
      await store.saveIntentResponse(invocation.id, previous, status);
      return;
    }
    await store.saveIntentResponse(
      invocation.id,
      { ...previous, state: "uncertain" },
      PushRequestStatus.Pending,
    );
    throw new InvalidChallengeIntentError(
      "A previous response attempt may have reached the server. Review this sign-in in the app before trying again.",
    );
  }
  if (
    Object.values(store.intentResponses).some(
      (response) =>
        response.requestId === requestId && response.state !== "completed",
    )
  ) {
    throw new InvalidChallengeIntentError(
      "A previous response attempt needs review in the app before another shortcut can respond.",
    );
  }
  const request = store.getPushRequestById(requestId);
  const token = useTokenStore
    .getState()
    .tokens.find((item) => item.id === request?.serial);
  const now = Date.now();
  if (
    !request ||
    request.status !== PushRequestStatus.Pending ||
    !Number.isFinite(request.sentAt) ||
    request.sentAt > now ||
    now - request.sentAt >= PUSH_REQUEST_MAX_AGE_MS ||
    !Number.isFinite(invocation.createdAt) ||
    invocation.createdAt > now ||
    now - invocation.createdAt >= PUSH_REQUEST_MAX_AGE_MS ||
    !token ||
    token.rolloutState !== PushTokenRolloutState.Completed
  ) {
    throw new InvalidChallengeIntentError(
      "This sign-in request is expired, already handled, or no longer available. Check for new requests in the app.",
    );
  }

  const response = { requestId, approve, state: "submitting" } as const;
  // Reserve the request and persist the attempt before the network operation.
  // A replay after termination must never automatically resubmit an uncertain decision.
  await store.saveIntentResponse(invocation.id, response, status);
  const result = await handlePushAuthRequest({ ...request, status }, token);
  if (!result.success) {
    await store.saveIntentResponse(
      invocation.id,
      { ...response, state: "uncertain" },
      PushRequestStatus.Pending,
    );
    throw new InvalidChallengeIntentError(
      "The sign-in response could not be confirmed. Review the request in the app before retrying.",
    );
  }
  await store.saveIntentResponse(
    invocation.id,
    { ...response, state: "completed" },
    status,
  );
}

export function publishTokenCatalog(tokens: PushToken[]): Promise<void> {
  const catalog = tokens.map((token) => ({
    id: token.id,
    title: token.label.trim() || token.id,
    subtitle: token.issuer?.trim() || undefined,
    hideInSpotlight: true,
  }));
  const publication = catalogQueue.then(() =>
    AppIntents.setEntityCatalogAsync("pushToken", catalog),
  );
  // A failed update must not prevent subsequent updates from running.
  catalogQueue = publication.catch(() => {});
  return publication;
}

export async function handleAppIntents(
  invocations: AppIntents.AppIntentInvocation[],
  onChallengeResult?: (error?: Error) => void,
): Promise<void> {
  for (const invocation of invocations) {
    let challengeCompleted = false;
    try {
      switch (invocation.name) {
        case "respondToChallenge":
          router.navigate("/");
          await respondToChallenge(invocation);
          challengeCompleted = true;
          onChallengeResult?.();
          break;
        case "openTokens":
          router.navigate("/");
          break;
        case "pairToken":
          router.navigate("/token/add");
          break;
        case "openToken": {
          const tokenId = invocation.params.tokenId;
          if (
            typeof tokenId !== "string" ||
            !useTokenStore
              .getState()
              .tokens.some((token) => token.id === tokenId)
          ) {
            console.warn(
              "Discarding App Intent for an invalid or deleted token",
              invocation.id,
            );
            break;
          }
          router.navigate({
            pathname: "/token/[tokenId]",
            params: { tokenId, edit: "0" },
          });
          break;
        }
        default:
          // Unsupported actions are reported and discarded, never executed as another action.
          console.warn(
            "Discarding unsupported App Intent",
            invocation.name,
            invocation.id,
          );
      }
      // Navigation is safe to replay; challenge responses have a durable attempt record.
      await AppIntents.removePendingInvocationAsync(invocation.id);
    } catch (error) {
      if (invocation.name === "respondToChallenge" && !challengeCompleted) {
        onChallengeResult?.(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
      if (error instanceof InvalidChallengeIntentError) {
        console.warn(
          "Discarding invalid or uncertain challenge response",
          invocation.id,
        );
        try {
          await AppIntents.removePendingInvocationAsync(invocation.id);
        } catch (removalError) {
          console.warn(
            "Could not remove invalid challenge response",
            invocation.id,
            removalError,
          );
        }
        continue;
      }
      console.warn(
        "App Intent remains pending for a later event or launch",
        invocation.id,
        error,
      );
    }
  }
}
