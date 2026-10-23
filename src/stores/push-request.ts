import { PUSH_REQUEST_MAX_AGE_MS } from "@/constants/push-request";
import type { PushRequest } from "@/types/push-request";
import { PushRequestStatus } from "@/types/push-request";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type PushRequestState = {
  pushRequests: PushRequest[];
  intentResponses: Record<string, IntentResponse>;
  saveIntentResponse: (
    invocationId: string,
    response: IntentResponse,
    status: PushRequestStatus,
  ) => Promise<void>;
  clearPushRequests: () => void;
  addPushRequest: (request: PushRequest) => boolean;
  updatePushRequestStatus: (id: string, status: PushRequestStatus) => void;
  removePushRequest: (id: string) => void;
  getPushRequestById: (id: string) => PushRequest | undefined;
  getPushRequestByNonce: (nonce: string) => PushRequest | undefined;
  getPendingPushRequests: () => PushRequest[];
  clearExpiredPushRequests: (maxAgeMs?: number) => void;
};

export type IntentResponse = {
  requestId: string;
  approve: boolean;
  state: "submitting" | "completed" | "uncertain";
};

export const usePushRequestStore = create(
  persist<PushRequestState>(
    (set, get) => ({
      pushRequests: [],
      intentResponses: {},

      saveIntentResponse: async (invocationId, response, status) => {
        // Zustand persist returns its storage write from set. Await it before sending
        // a response or acknowledging an invocation. Both records share one snapshot.
        await set((state) => ({
          intentResponses: {
            ...state.intentResponses,
            [invocationId]: response,
          },
          pushRequests: state.pushRequests.map((request) =>
            request.id === response.requestId
              ? { ...request, status }
              : request,
          ),
        }));
      },

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

      clearExpiredPushRequests: (
        maxAgeMs: number = PUSH_REQUEST_MAX_AGE_MS,
      ) => {
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
