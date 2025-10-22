import { PushToken } from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type TokenState = {
  tokens: PushToken[];
  addToken: (token: PushToken) => void;
  removeToken: (id: string) => void;
};

export const useTokenStore = () =>
  create(
    persist<TokenState>(
      (set, get) => ({
        tokens: [{ id: "demo-token", version: "1", label: "Demo Token", issuer: "Demo Issuer" }],
        addToken: (token: PushToken) => {
          const existingTokens = get().tokens;
          const tokenExists = existingTokens.some((t) => t.id === token.id);
          if (!tokenExists) {
            set({ tokens: [...existingTokens, token] });
          }
        },
        removeToken: (id: string) => {
          const existingTokens = get().tokens;
          const updatedTokens = existingTokens.filter((t) => t.id !== id);
          set({ tokens: updatedTokens });
        },
      }),
      {
        name: "token-storage",
        storage: createJSONStorage(() => AsyncStorage),
      },
    ),
  );
