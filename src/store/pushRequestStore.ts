import { PushRequest, PushRequestStatus } from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type PushRequestState = {
  pushRequests: PushRequest[];
  clearPushRequests: () => void;
  addPushRequest: (request: PushRequest) => boolean;
  updatePushRequestStatus: (id: string, status: PushRequestStatus) => void;
  removePushRequest: (id: string) => void;
  getPushRequestById: (id: string) => PushRequest | undefined;
  getPushRequestByNonce: (nonce: string) => PushRequest | undefined;
  getPendingPushRequests: () => PushRequest[];
  clearExpiredPushRequests: (maxAgeMs?: number) => void;
};

const DEFAULT_MAX_AGE_MS = 2 * 60 * 1000; // 2 minutes

export const usePushRequestStore = create(
  persist<PushRequestState>(
    (set, get) => ({
      pushRequests: [],

      clearPushRequests: () => set({ pushRequests: [] }),

      addPushRequest: (request: PushRequest) => {
        const existingRequests = get().pushRequests;
        // Check if request with same id or nonce already exists
        const requestExists = existingRequests.some(
          (r) => r.id === request.id || r.nonce === request.nonce,
        );
        if (!requestExists) {
          set({ pushRequests: [...existingRequests, request] });
          return true;
        }

        return false;
      },

      updatePushRequestStatus: (id: string, status: PushRequestStatus) => {
        const existingRequests = get().pushRequests;
        const updatedRequests = existingRequests.map((r) =>
          r.id === id ? { ...r, status } : r,
        );
        set({ pushRequests: updatedRequests });
      },

      removePushRequest: (id: string) => {
        const existingRequests = get().pushRequests;
        const updatedRequests = existingRequests.filter((r) => r.id !== id);
        set({ pushRequests: updatedRequests });
      },

      getPushRequestById: (id: string) => {
        return get().pushRequests.find((r) => r.id === id);
      },

      getPushRequestByNonce: (nonce: string) => {
        return get().pushRequests.find((r) => r.nonce === nonce);
      },

      getPendingPushRequests: () => {
        return get().pushRequests.filter(
          (r) => r.status === PushRequestStatus.Pending,
        );
      },

      clearExpiredPushRequests: (maxAgeMs: number = DEFAULT_MAX_AGE_MS) => {
        const now = Date.now();
        const existingRequests = get().pushRequests;
        // Mark expired pending requests as expired instead of removing
        const updatedRequests = existingRequests.map((r) => {
          const age = now - r.sentAt;
          if (age >= maxAgeMs && r.status === PushRequestStatus.Pending) {
            return { ...r, status: PushRequestStatus.Expired };
          }
          return r;
        });
        set({ pushRequests: updatedRequests });
      },
    }),
    {
      name: "push-request-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
