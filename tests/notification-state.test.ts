import { synchronizeNotificationState } from "@/services/notification-state";
import { useTokenStore } from "@/stores/token";
import { usePushRequestStore } from "@/stores/push-request";
import { synchronizeNativeNotifications } from "@/utils/native-notifications";
import { PushRequestStatus } from "@/types/push-request";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { request, token } from "./fixtures";

jest.mock("@/services/token-rollout", () => ({
  startPendingRollouts: jest.fn(),
}));
jest.mock("@/utils/native-notifications", () => ({
  synchronizeNativeNotifications: jest.fn(),
}));
jest.mock("@react-native-firebase/messaging", () => ({}));

beforeEach(async () => {
  await Promise.all([
    useTokenStore.persist.rehydrate(),
    usePushRequestStore.persist.rehydrate(),
  ]);
  useTokenStore.setState({
    tokens: [token, { ...token, id: "another-backend" }],
  });
  usePushRequestStore.getState().clearPushRequests();
  jest.mocked(synchronizeNativeNotifications).mockResolvedValue([]);
});

function delivered(
  id: string,
  nonce: string,
  serial = token.id,
  category = "PUSH_AUTHENTICATION",
): Notifications.Notification {
  return {
    date: Date.now(),
    request: {
      identifier: id,
      trigger: null,
      content: {
        title: request.title,
        subtitle: null,
        body: request.question,
        data: { nonce, serial },
        sound: null,
        categoryIdentifier: category,
      },
    },
  };
}

test("aggregates pending badges across backends and dismisses resolved and expired notifications", async () => {
  jest.replaceProperty(Platform, "OS", "android");
  const store = usePushRequestStore.getState();
  store.addPushRequest({ ...request, sentAt: Date.now() });
  store.addPushRequest({
    ...request,
    id: "another",
    nonce: "another",
    serial: "another-backend",
    sentAt: Date.now(),
  });
  store.addPushRequest({
    ...request,
    id: "done",
    nonce: "done",
    status: PushRequestStatus.Accepted,
  });
  store.addPushRequest({
    ...request,
    id: "old",
    nonce: "old",
    sentAt: Date.now() - 120_000,
  });
  store.addPushRequest({
    ...request,
    id: "deleted",
    nonce: "deleted",
    serial: "deleted-token",
    sentAt: Date.now(),
  });
  jest
    .mocked(Notifications.getPresentedNotificationsAsync)
    .mockResolvedValue([
      delivered("pending", request.nonce),
      delivered("done", "done"),
      delivered("old", "old"),
      delivered("unrelated", "unrelated", token.id, "OTHER"),
    ]);
  await synchronizeNotificationState();
  expect(Notifications.setBadgeCountAsync).toHaveBeenCalledWith(2);
  expect(
    jest.mocked(Notifications.dismissNotificationAsync).mock.calls,
  ).toEqual([["done"], ["old"]]);
  expect(store.getPushRequestByNonce("old")?.status).toBe(
    PushRequestStatus.Expired,
  );
});

test("reconciles native Watch results on iOS without overwriting completed requests with failures", async () => {
  jest.replaceProperty(Platform, "OS", "ios");
  const accepted = {
    ...request,
    sentAt: Date.now(),
    status: PushRequestStatus.Accepted,
  };
  jest.mocked(synchronizeNativeNotifications).mockResolvedValue([accepted]);
  await synchronizeNotificationState();
  expect(
    usePushRequestStore.getState().getPushRequestByNonce(request.nonce)?.status,
  ).toBe(PushRequestStatus.Accepted);
  jest
    .mocked(synchronizeNativeNotifications)
    .mockResolvedValue([{ ...accepted, status: PushRequestStatus.Pending }]);
  await synchronizeNotificationState();
  expect(
    usePushRequestStore.getState().getPushRequestByNonce(request.nonce)?.status,
  ).toBe(PushRequestStatus.Accepted);
  expect(Notifications.setBadgeCountAsync).not.toHaveBeenCalled();
  expect(Notifications.dismissNotificationAsync).not.toHaveBeenCalled();
});

test("recovers from a failed reconciliation and ignores results for removed tokens", async () => {
  jest.replaceProperty(Platform, "OS", "ios");
  jest
    .mocked(synchronizeNativeNotifications)
    .mockRejectedValueOnce(new Error("unavailable"));
  await expect(synchronizeNotificationState()).rejects.toThrow("unavailable");
  jest
    .mocked(synchronizeNativeNotifications)
    .mockResolvedValue([
      { ...request, serial: "removed", status: PushRequestStatus.Accepted },
    ]);
  await synchronizeNotificationState();
  expect(usePushRequestStore.getState().pushRequests).toEqual([]);
});
