import { registerBackgroundNotifications } from "@/services/background-notifications";
import { receivePushRequest } from "@/services/push-notification";
import { setBackgroundMessageHandler } from "@react-native-firebase/messaging";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { request } from "./fixtures";

const messageData = {
  nonce: request.nonce,
  serial: request.serial,
  question: request.question,
  title: request.title,
  signature: request.signature,
  sslverify: request.sslverify,
  url: request.url,
};

jest.mock("@react-native-firebase/messaging", () => ({
  getMessaging: jest.fn(),
  setBackgroundMessageHandler: jest.fn(),
}));
jest.mock("@/services/push-notification", () => ({
  receivePushRequest: jest.fn(),
}));
jest.mock("@/services/notification-state", () => ({
  synchronizeNotificationState: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/utils/locale", () => ({ activateCurrentLocale: jest.fn() }));
jest.mock("@/utils/notification", () => ({
  ...jest.requireActual("@/utils/notification"),
  setupNotificationCategories: jest.fn().mockResolvedValue(undefined),
}));

test.each(["android", "ios"] as const)(
  "presents local actions only on %s Android",
  async (os) => {
    jest.replaceProperty(Platform, "OS", os);
    const freshRequest = { ...request, sentAt: Date.now() };
    jest.mocked(receivePushRequest).mockResolvedValue(freshRequest);
    registerBackgroundNotifications();
    const handler = jest.mocked(setBackgroundMessageHandler).mock.calls[0][1];
    await handler({ messageId: request.id, data: messageData });
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(
      os === "android" ? 1 : 0,
    );
    if (os === "android") {
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        identifier: request.id,
        content: {
          title: request.title,
          body: request.question,
          data: { ...freshRequest, pushRequestId: request.id },
          categoryIdentifier: "PUSH_AUTHENTICATION",
          sound: "default",
        },
        trigger: { channelId: "push-auth" },
      });
    }
  },
);

test("does not present unverified or expired Android challenges", async () => {
  jest.replaceProperty(Platform, "OS", "android");
  registerBackgroundNotifications();
  const handler = jest.mocked(setBackgroundMessageHandler).mock.calls[0][1];
  jest
    .mocked(receivePushRequest)
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce(request);
  await handler({ data: messageData });
  await handler({ data: messageData });
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});
