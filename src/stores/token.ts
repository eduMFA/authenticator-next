import {
  isTokenRollingOut,
  performTokenRollout,
  startPendingRollouts as startPendingRolloutsService,
} from "@/services/token-rollout";
import { usePushRequestStore } from "@/stores/push-request";
import { PushTokenRolloutState, type PushToken } from "@/types/token";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type TokenState = {
  tokens: PushToken[];
  addToken: (token: PushToken) => void;
  updateToken: (
    id: string,
    newState: Partial<PushToken>,
  ) => void | Promise<void>;
  removeToken: (id: string) => void;
  rolloutToken: (id: string) => Promise<void>;
  startPendingRollouts: () => void;
  isRollingOut: (id: string) => boolean;
};

export const useTokenStore = create(
  persist<TokenState>(
    (set, get) => ({
      tokens: [],

      addToken: (token: PushToken) => {
        const existingTokens = get().tokens;
        const tokenExists = existingTokens.some((t) => t.id === token.id);
        if (!tokenExists) {
          set({ tokens: [...existingTokens, token] });
        }
      },

      updateToken: (id: string, newState: Partial<PushToken>) => {
        const existingTokens = get().tokens;
        if (!existingTokens.some((t) => t.id === id)) {
          throw new Error("Token not found");
        }
        const updatedTokens = existingTokens.map((t) =>
          t.id === id ? { ...t, ...newState } : t,
        );
        return set({ tokens: updatedTokens }) as void | Promise<void>;
      },

      removeToken: (id: string) => {
        const existingTokens = get().tokens;
        const updatedTokens = existingTokens.filter((t) => t.id !== id);
        set({ tokens: updatedTokens });
        usePushRequestStore.getState().removePushRequestsForToken(id);
      },

      isRollingOut: (id: string) => {
        return isTokenRollingOut(id);
      },

      rolloutToken: async (id: string) => {
        const { tokens, updateToken } = get();
        const token = tokens.find((t) => t.id === id);

        if (!token) {
          throw new Error("Token not found");
        }

        const result = await performTokenRollout(token, updateToken);

        if (!result.success && result.error) {
          throw result.error;
        }
      },

      startPendingRollouts: () => {
        const { updateToken } = get();

        startPendingRolloutsService(() => get().tokens, updateToken);
      },
    }),
    {
      name: "token-storage",
      storage: createJSONStorage(() => AsyncStorage),
      // Don't persist rollout-related functions, only the tokens array
      partialize: (state) => ({ tokens: state.tokens }) as TokenState,
      merge: (persisted, current) => {
        const saved = persisted as Pick<TokenState, "tokens"> | undefined;
        return {
          ...current,
          tokens: (saved?.tokens ?? current.tokens).map((token) =>
            Object.hasOwn(PushTokenRolloutState, token.rolloutState)
              ? token
              : { ...token, rolloutState: PushTokenRolloutState.Pending },
          ),
        };
      },
      onRehydrateStorage: () => {
        return (state) => {
          // Start pending rollouts after the store has been rehydrated
          if (state && AppState.currentState !== "background") {
            console.log("Token store rehydrated, starting pending rollouts...");
            // Use setTimeout to ensure the store is fully ready
            setTimeout(() => {
              state.startPendingRollouts();
            }, 100);
          }
        };
      },
    },
  ),
);
