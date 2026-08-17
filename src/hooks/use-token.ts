import { deleteTokenPrivateKey } from "@/services/token-rollout";
import { useActivityStore } from "@/stores/activity";
import { useTokenStore } from "@/stores/token";
import { ActivityType } from "@/types/activity";
import { PushTokenRolloutState } from "@/types/token";
import { parseTokenFromUri } from "@/utils/token";
import { useCallback } from "react";

// Selectors for better performance - defined outside to maintain referential stability
const selectTokens = (state: ReturnType<typeof useTokenStore.getState>) =>
  state.tokens;
const selectAddToken = (state: ReturnType<typeof useTokenStore.getState>) =>
  state.addToken;
const selectUpdateToken = (state: ReturnType<typeof useTokenStore.getState>) =>
  state.updateToken;
const selectRemoveToken = (state: ReturnType<typeof useTokenStore.getState>) =>
  state.removeToken;
const selectRolloutToken = (state: ReturnType<typeof useTokenStore.getState>) =>
  state.rolloutToken;

export function useToken() {
  const tokens = useTokenStore(selectTokens);
  const addToken = useTokenStore(selectAddToken);
  const updateToken = useTokenStore(selectUpdateToken);
  const removeToken = useTokenStore(selectRemoveToken);
  const rolloutTokenFromStore = useTokenStore(selectRolloutToken);
  const addActivity = useActivityStore((state) => state.addActivity);
  const clearTokenActivities = useActivityStore(
    (state) => state.clearTokenActivities,
  );

  const createTokenFromURI = useCallback(
    async (uri: string) => {
      const newToken = parseTokenFromUri(uri);

      if (tokens.some((token) => token.id === newToken.id)) {
        return;
      }

      addToken(newToken);
      addActivity({
        tokenId: newToken.id,
        type: ActivityType.EnrollmentStarted,
        timestamp: Date.now(),
      });

      try {
        await rolloutTokenFromStore(newToken.id);
        addActivity({
          tokenId: newToken.id,
          type: ActivityType.EnrollmentCompleted,
          timestamp: Date.now(),
        });
      } catch (error) {
        addActivity({
          tokenId: newToken.id,
          type: ActivityType.EnrollmentFailed,
          timestamp: Date.now(),
        });
        console.error(
          `Failed to rollout newly added token ${newToken.id}:`,
          error,
        );
      }
    },
    [addActivity, addToken, rolloutTokenFromStore, tokens],
  );

  const rolloutToken = useCallback(
    async (id: string) => {
      const token = tokens.find((t) => t.id === id);
      if (!token) {
        throw new Error("Token not found");
      }

      if (token.rolloutState === PushTokenRolloutState.Completed) {
        throw new Error("Token rollout already completed");
      }

      // Reset failed state to pending before retrying
      if (PushTokenRolloutState.isFailed(token.rolloutState)) {
        updateToken(id, { rolloutState: PushTokenRolloutState.Pending });
      }

      addActivity({
        tokenId: id,
        type: ActivityType.EnrollmentStarted,
        timestamp: Date.now(),
      });

      try {
        await rolloutTokenFromStore(id);
        addActivity({
          tokenId: id,
          type: ActivityType.EnrollmentCompleted,
          timestamp: Date.now(),
        });
      } catch (error) {
        addActivity({
          tokenId: id,
          type: ActivityType.EnrollmentFailed,
          timestamp: Date.now(),
        });
        throw error;
      }
    },
    [addActivity, tokens, updateToken, rolloutTokenFromStore],
  );

  const deleteToken = useCallback(
    async (id: string) => {
      const token = tokens.find((t) => t.id === id);
      if (!token) {
        throw new Error("Token not found");
      }

      // Delete the private key if the token has a public key (meaning keys were generated)
      if (token.publicKey) {
        try {
          await deleteTokenPrivateKey(id);
        } catch (error) {
          // Log but don't fail the deletion - the key might already be gone
          console.warn(`Could not delete private key for token ${id}:`, error);
        }
      }

      removeToken(id);
      clearTokenActivities(id);
    },
    [clearTokenActivities, tokens, removeToken],
  );

  return {
    tokens,
    deleteToken,
    addToken,
    updateToken,
    createTokenFromURI,
    rolloutToken,
  };
}
