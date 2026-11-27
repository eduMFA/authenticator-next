import { registerBackgroundNotifications } from "@/services/background-notifications";
import { receivePushRequest } from "@/services/push-notification";
import { useTokenStore } from "@/stores/token";
import { messages } from "@/locales/en/messages";
import { i18n } from "@lingui/core";
import { setBackgroundMessageHandler } from "@react-native-firebase/messaging";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { request, token } from "./fixtures";

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
jest.mock("@/services/token-rollout", () => ({
  startPendingRollouts: jest.fn(),
}));
jest.mock("@/services/notification-state", () => ({
  synchronizeNotificationState: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/utils/locale", () => ({ activateCurrentLocale: jest.fn() }));
jest.mock("@/utils/notification", () => ({
  ...jest.requireActual("@/utils/notification"),
  setupNotificationCategories: jest.fn().mockResolvedValue(undefined),
}));

beforeEach(async () => {
  await useTokenStore.persist.rehydrate();
  useTokenStore.setState({ tokens: [] });
});

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

test("omits a serial used as the default label from Android notification text", async () => {
  jest.replaceProperty(Platform, "OS", "android");
  useTokenStore.setState({ tokens: [{ ...token, label: token.id }] });
  jest.mocked(receivePushRequest).mockResolvedValue({
    ...request,
    sentAt: Date.now(),
  });
  registerBackgroundNotifications();
  const handler = jest.mocked(setBackgroundMessageHandler).mock.calls[0][1];
  await handler({ messageId: request.id, data: messageData });
  const notification = jest.mocked(Notifications.scheduleNotificationAsync)
    .mock.calls[0][0];
  expect(notification.content.title).toBe(request.title);
  expect(notification.content.data).toMatchObject({ serial: token.id });
});

test("renders V2 notification text locally without changing the signed data", async () => {
  jest.replaceProperty(Platform, "OS", "android");
  i18n.loadAndActivate({ locale: "en", messages });
  useTokenStore.setState({
    tokens: [
      {
        ...token,
        label: "Campus account",
        imageUrl: "https://example.org/icon.png",
      },
    ],
  });
  jest
    .mocked(receivePushRequest)
    .mockImplementation(async (incoming) => incoming);
  registerBackgroundNotifications();
  const handler = jest.mocked(setBackgroundMessageHandler).mock.calls[0][1];
  const { question: _question, ...data } = messageData;
  await handler({
    messageId: request.id,
    data: {
      ...data,
      eduMfaTokenImageUrl: "https://untrusted.example/icon.png",
    },
    sentTime: Date.now(),
  });
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  const notification = jest.mocked(Notifications.scheduleNotificationAsync).mock
    .calls[0][0];
  expect(notification.content.body).toBe("Do you want to confirm the sign-in?");
  expect(notification.content.title).toBe("Login · Campus account");
  expect(notification.content.data).toMatchObject({
    title: "Login",
    eduMfaTokenImageUrl: "https://example.org/icon.png",
  });
  expect(notification.content.data).not.toHaveProperty("question");
});
