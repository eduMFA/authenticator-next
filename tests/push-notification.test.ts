import { useTokenStore } from "@/stores/token";
import { usePushRequestStore } from "@/stores/push-request";
import {
  handleNotificationResponse,
  receivePushRequest,
  submitPushRequest,
} from "@/services/push-notification";
import { handlePushAuthRequest } from "@/services/push-auth";
import { verifyMessage } from "@/utils/rsa";
import { PushRequestStatus } from "@/types/push-request";
import type * as Notifications from "expo-notifications";
import { deferred, request, token } from "./fixtures";
import { Platform } from "react-native";
import {
  submitNativeNotification,
  synchronizeNativeNotifications,
} from "@/utils/native-notifications";

jest.mock("@/utils/native-notifications", () => ({
  submitNativeNotification: jest.fn(),
  synchronizeNativeNotifications: jest.fn().mockResolvedValue([]),
}));

jest.mock("@react-native-firebase/messaging", () => ({
  getMessaging: jest.fn(),
  onMessage: jest.fn(),
  setBackgroundMessageHandler: jest.fn(),
}));

jest.mock("@/services/token-rollout", () => ({
  startPendingRollouts: jest.fn(),
}));
jest.mock("@/utils/rsa", () => ({ verifyMessage: jest.fn() }));
jest.mock("@/services/push-auth", () => ({
  findTokenForPushRequest: jest.fn(
    (candidate: typeof request, tokens: (typeof token)[]) =>
      tokens.find((item) => item.id === candidate.serial),
  ),
  handlePushAuthRequest: jest.fn(),
}));

let sequence = 0;
function response(
  actionIdentifier = "ACCEPT",
): Notifications.NotificationResponse {
  return {
    actionIdentifier,
    notification: {
      date: Date.now(),
      request: {
        identifier: `notification-${sequence++}`,
        trigger: null,
        content: {
          title: request.title,
          subtitle: null,
          body: request.question,
          data: { ...request },
          sound: null,
          categoryIdentifier: "PUSH_AUTHENTICATION",
        },
      },
    },
  };
}

beforeEach(async () => {
  jest.replaceProperty(Platform, "OS", "android");
  await Promise.all([
    useTokenStore.persist.rehydrate(),
    usePushRequestStore.persist.rehydrate(),
  ]);
  useTokenStore.setState({
    tokens: [{ ...token, serverPublicKey: "public-key" }],
  });
  usePushRequestStore.getState().clearPushRequests();
  jest.mocked(verifyMessage).mockResolvedValue(true);
  jest.mocked(handlePushAuthRequest).mockResolvedValue({ success: true });
});

test.each([
  ["ACCEPT", PushRequestStatus.Accepted],
  ["DECLINE", PushRequestStatus.Declined],
])(
  "verifies and submits %s from a cold notification response",
  async (action, status) => {
    expect(await handleNotificationResponse(response(action))).toBe(true);
    expect(verifyMessage).toHaveBeenCalled();
    expect(handlePushAuthRequest).toHaveBeenCalledWith(
      expect.objectContaining({ nonce: request.nonce, status }),
      expect.objectContaining({ id: token.id }),
    );
    expect(
      usePushRequestStore.getState().getPushRequestByNonce(request.nonce)
        ?.status,
    ).toBe(status);
  },
);

test("does not submit or store a request with an invalid signature", async () => {
  jest.mocked(verifyMessage).mockResolvedValue(false);
  expect(await handleNotificationResponse(response())).toBe(false);
  expect(handlePushAuthRequest).not.toHaveBeenCalled();
  expect(usePushRequestStore.getState().pushRequests).toEqual([]);
});

test("leaves failed actions pending and allows the same response to retry", async () => {
  const notification = response();
  jest.mocked(handlePushAuthRequest).mockResolvedValueOnce({ success: false });
  expect(await handleNotificationResponse(notification)).toBe(false);
  expect(
    usePushRequestStore.getState().getPushRequestByNonce(request.nonce)?.status,
  ).toBe(PushRequestStatus.Pending);
  expect(await handleNotificationResponse(notification)).toBe(true);
  expect(await handleNotificationResponse(notification)).toBe(true);
  expect(handlePushAuthRequest).toHaveBeenCalledTimes(2);
});

test("deduplicates simultaneous actions and updates status only after submission", async () => {
  const pending = deferred<{ success: boolean }>();
  jest.mocked(handlePushAuthRequest).mockReturnValue(pending.promise);
  const notification = response();
  const first = handleNotificationResponse(notification);
  const second = handleNotificationResponse(notification);
  // Wait until verification has stored the request and submission has started.
  for (let i = 0; i < 20; i++) await Promise.resolve();
  expect(handlePushAuthRequest).toHaveBeenCalledTimes(1);
  expect(
    usePushRequestStore.getState().getPushRequestByNonce(request.nonce)?.status,
  ).toBe(PushRequestStatus.Pending);
  pending.resolve({ success: true });
  expect(await Promise.all([first, second])).toEqual([true, true]);
});

test("waits for token hydration before verifying an initial response", async () => {
  const hydration = deferred<void>();
  jest.spyOn(useTokenStore.persist, "hasHydrated").mockReturnValue(false);
  jest
    .spyOn(useTokenStore.persist, "onFinishHydration")
    .mockImplementation((finish) => {
      void hydration.promise.then(() => finish(useTokenStore.getState()));
      return jest.fn();
    });
  const processing = handleNotificationResponse(response());
  await Promise.resolve();
  expect(verifyMessage).not.toHaveBeenCalled();
  hydration.resolve();
  expect(await processing).toBe(true);
});

test("deduplicates conflicting actions from different notifications for one challenge", async () => {
  const pending = deferred<{ success: boolean }>();
  jest.mocked(handlePushAuthRequest).mockReturnValue(pending.promise);
  const accept = handleNotificationResponse(response("ACCEPT"));
  const decline = handleNotificationResponse(response("DECLINE"));
  for (let i = 0; i < 20; i++) await Promise.resolve();
  expect(handlePushAuthRequest).toHaveBeenCalledTimes(1);
  pending.resolve({ success: true });
  expect(await Promise.all([accept, decline])).toEqual([true, true]);
  expect(
    usePushRequestStore.getState().getPushRequestByNonce(request.nonce)?.status,
  ).toBe(PushRequestStatus.Accepted);
});

test("expires old requests instead of submitting them", async () => {
  await receivePushRequest({ ...request, sentAt: Date.now() - 120_000 });
  expect(
    await submitPushRequest({ ...request, status: PushRequestStatus.Accepted }),
  ).toBe(false);
  expect(handlePushAuthRequest).not.toHaveBeenCalled();
  expect(
    usePushRequestStore.getState().getPushRequestByNonce(request.nonce)?.status,
  ).toBe(PushRequestStatus.Expired);
});

test("iOS submits through the native handler and reconciles its authoritative result", async () => {
  jest.replaceProperty(Platform, "OS", "ios");
  const notification = response();
  // A Watch decline may win a race with an Accept in the popup.
  const declined = {
    ...request,
    id: notification.notification.request.identifier,
    sentAt: notification.notification.date,
    status: PushRequestStatus.Declined,
  };
  jest
    .mocked(synchronizeNativeNotifications)
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([declined]);
  jest.mocked(submitNativeNotification).mockResolvedValue(true);
  expect(await handleNotificationResponse(notification)).toBe(true);
  expect(handlePushAuthRequest).not.toHaveBeenCalled();
  expect(submitNativeNotification).toHaveBeenCalledWith(
    expect.objectContaining({ status: PushRequestStatus.Accepted }),
  );
  expect(
    usePushRequestStore.getState().getPushRequestByNonce(request.nonce)?.status,
  ).toBe(PushRequestStatus.Declined);
});
