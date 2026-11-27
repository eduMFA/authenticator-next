import {
  presentBackgroundPushRequest,
  verifyIncomingPushRequest,
} from "@/services/push-delivery";
import { usePushRequestStore } from "@/stores/push-request";
import { useTokenStore } from "@/stores/token";
import { PushTokenRolloutState } from "@/types/token";
import { verifyMessage } from "@/utils/rsa";
import { scheduleNotificationAsync } from "expo-notifications";
import { request, token } from "./fixtures";

jest.mock("@/utils/rsa", () => ({ verifyMessage: jest.fn() }));
jest.mock("@/services/token-rollout", () => ({
  startPendingRollouts: jest.fn(),
}));

beforeEach(async () => {
  jest.useFakeTimers();
  await useTokenStore.persist.rehydrate();
  await usePushRequestStore.persist.rehydrate();
  useTokenStore.setState({
    tokens: [
      {
        ...token,
        rolloutState: PushTokenRolloutState.Completed,
        serverPublicKey: "server-key",
      },
    ],
  });
  usePushRequestStore.getState().clearPushRequests();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

test("displays a verified data-only request once and retains the signed action data", async () => {
  jest.mocked(verifyMessage).mockResolvedValue(true);
  await presentBackgroundPushRequest(request);
  await presentBackgroundPushRequest({ ...request, id: "duplicate" });
  expect(scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  expect(scheduleNotificationAsync).toHaveBeenCalledWith({
    identifier: "push-auth-serial-nonce",
    content: {
      title: `${request.title} · ${token.label}`,
      body: request.question,
      data: { ...request, pushRequestId: request.id },
      categoryIdentifier: "PUSH_AUTHENTICATION",
      sound: "default",
    },
    trigger: { channelId: "push-auth" },
  });
});

test("discards a request with an invalid signature", async () => {
  jest.mocked(verifyMessage).mockResolvedValue(false);
  await presentBackgroundPushRequest(request);
  expect(scheduleNotificationAsync).not.toHaveBeenCalled();
  expect(usePushRequestStore.getState().pushRequests).toEqual([]);
});

test("uses the enrolled version to verify V2 data and rejects an injected question", async () => {
  useTokenStore.getState().updateToken(token.id, { version: 2 });
  jest.mocked(verifyMessage).mockResolvedValue(true);

  expect(await verifyIncomingPushRequest(request)).toBe(false);
  expect(verifyMessage).not.toHaveBeenCalled();
  expect(
    await verifyIncomingPushRequest({ ...request, question: undefined }),
  ).toBe(true);
  expect(verifyMessage).toHaveBeenCalledWith(
    "nonce|https://example.org/push|serial|Login|1",
    "Zg==",
    "server-key",
  );
});
