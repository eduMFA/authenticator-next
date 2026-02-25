import { deleteTokenPrivateKey } from "@/services/tokenRolloutService";
import { useTokenStore } from "@/store/tokenStore";
import { PushTokenRolloutState } from "@/types";
import { parseTokenFromUri } from "@/utils/tokenUtils";
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

  const createTokenFromURI = useCallback(
    (uri: string) => {
      const newToken = parseTokenFromUri(uri);

      addToken(newToken);

      // Trigger rollout for the newly added token
      rolloutTokenFromStore(newToken.id).catch((error) => {
        console.error(
          `Failed to rollout newly added token ${newToken.id}:`,
          error,
        );
      });
    },
    [addToken, rolloutTokenFromStore],
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

      await rolloutTokenFromStore(id);
    },
    [tokens, updateToken, rolloutTokenFromStore],
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
    },
    [tokens, removeToken],
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
