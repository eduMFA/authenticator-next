import { i18n } from "@lingui/core";
import { messages } from "@/locales/en/messages";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import {
  getMessaging,
  onMessage,
  setBackgroundMessageHandler,
  type RemoteMessage,
} from "@react-native-firebase/messaging";
import {
  addBackgroundMessageHandler,
  addMessageListener,
  cancelAllNotifications,
  cancelNotification,
  getNotificationAction,
  getNotificationResponseData,
  getNotificationResponseKey,
  isNotificationPermissionEnabled,
  isNotificationPermissionPending,
  parsePushRequest,
  parsePushRequestFromNotificationData,
  setupForegroundNotificationHandler,
  setupNotificationCategories,
  validatePushRequestData,
} from "@/utils/notification";
import { request } from "./fixtures";

jest.mock("@react-native-firebase/messaging", () => ({
  getMessaging: jest.fn(() => "messaging"),
  onMessage: jest.fn(),
  setBackgroundMessageHandler: jest.fn(),
}));
beforeEach(() => i18n.loadAndActivate({ locale: "en", messages }));

const message: RemoteMessage = {
  category: "PUSH_AUTHENTICATION",
  data: {
    nonce: request.nonce,
    question: request.question,
    serial: request.serial,
    signature: request.signature,
    sslverify: request.sslverify,
    title: request.title,
    url: request.url,
  },
  messageId: "message",
  sentTime: 123,
};
function permission(
  status: Notifications.PermissionStatus,
  granted = false,
  ios?: Notifications.IosAuthorizationStatus,
): Notifications.NotificationPermissionsStatus {
  return {
    status,
    granted,
    canAskAgain: true,
    expires: "never",
    ...(ios === undefined
      ? {}
      : {
          ios: {
            status: ios,
            allowsAlert: true,
            allowsBadge: true,
            allowsSound: true,
            allowsDisplayInNotificationCenter: true,
            allowsDisplayOnLockScreen: true,
            allowsDisplayInCarPlay: false,
            alertStyle: Notifications.IosAlertStyle.BANNER,
            allowsPreviews: Notifications.IosAllowsPreviews.ALWAYS,
            providesAppNotificationSettings: true,
            allowsCriticalAlerts: false,
            allowsAnnouncements: false,
          },
        }),
  };
}
function notificationResponse(
  actionIdentifier = "ACCEPT",
  data: Record<string, unknown> = { ...request },
): Notifications.NotificationResponse {
  return {
    actionIdentifier,
    notification: {
      date: 123,
      request: {
        identifier: "notification",
        trigger: null,
        content: {
          title: "Login",
          subtitle: null,
          body: "Sign in?",
          data,
          sound: null,
          categoryIdentifier: null,
        },
      },
    },
  };
}

test("permission flags include provisional iOS permission", () => {
  expect(isNotificationPermissionEnabled(null)).toBe(false);
  expect(
    isNotificationPermissionEnabled(
      permission(Notifications.PermissionStatus.GRANTED, true),
    ),
  ).toBe(true);
  expect(
    isNotificationPermissionEnabled(
      permission(Notifications.PermissionStatus.DENIED),
    ),
  ).toBe(false);
  expect(
    isNotificationPermissionEnabled(
      permission(
        Notifications.PermissionStatus.UNDETERMINED,
        false,
        Notifications.IosAuthorizationStatus.PROVISIONAL,
      ),
    ),
  ).toBe(true);
  expect(isNotificationPermissionPending(null)).toBe(true);
  expect(
    isNotificationPermissionPending(
      permission(Notifications.PermissionStatus.UNDETERMINED),
    ),
  ).toBe(true);
  expect(
    isNotificationPermissionPending(
      permission(Notifications.PermissionStatus.GRANTED),
    ),
  ).toBe(false);
});
test.each([
  null,
  undefined,
  1,
  "text",
  {},
  { ...request, nonce: 1 },
  { ...request, question: null },
  { ...request, serial: 1 },
  { ...request, signature: null },
  { ...request, sslverify: true },
  { ...request, title: 1 },
])("rejects invalid request data %p", (data) => {
  expect(validatePushRequestData(data)).toBe(false);
  expect(parsePushRequestFromNotificationData(data, "fallback")).toBeNull();
});
test("parses Firebase and local notification requests", () => {
  expect(parsePushRequest(message)).toEqual({
    ...request,
    id: "message",
    sentAt: 123,
  });
  expect(
    parsePushRequestFromNotificationData(request, "fallback", 456),
  ).toEqual({ ...request, id: "fallback", sentAt: 456 });
  jest.spyOn(Date, "now").mockReturnValue(999);
  expect(
    parsePushRequest({ ...message, messageId: undefined, sentTime: undefined }),
  ).toMatchObject({ id: "nonce-999", sentAt: 999 });
  expect(
    parsePushRequestFromNotificationData(request, "fallback")?.sentAt,
  ).toBe(999);
});
test("ignores unrelated and malformed messages", () => {
  expect(parsePushRequest({})).toBeNull();
  expect(parsePushRequest({ ...message, category: "other" })).toBeNull();
  expect(parsePushRequest({ ...message, data: {} })).toBeNull();
});
test.each([
  ["ACCEPT", "ACCEPT"],
  ["DECLINE", "DECLINE"],
  [Notifications.DEFAULT_ACTION_IDENTIFIER, "TAP"],
  ["unknown", null],
])("maps action %s", (identifier, expected) => {
  expect(getNotificationAction(identifier)).toBe(expected);
});
test("extracts response data and identifies responses by action", () => {
  const response = notificationResponse();
  expect(getNotificationResponseData(response)).toEqual(request);
  expect(getNotificationResponseKey(response)).toBe("notification:ACCEPT");
  expect(getNotificationResponseKey(notificationResponse("DECLINE"))).toBe(
    "notification:DECLINE",
  );
  response.notification.request.content.data = null as unknown as Record<
    string,
    unknown
  >;
  expect(getNotificationResponseData(response)).toEqual({});
});
test.each(["android", "ios"] as const)(
  "sets up categories on %s",
  async (os) => {
    jest.replaceProperty(Platform, "OS", os);
    const channel = jest
      .spyOn(Notifications, "setNotificationChannelAsync")
      .mockResolvedValue(null);
    const category = jest
      .spyOn(Notifications, "setNotificationCategoryAsync")
      .mockResolvedValue({ identifier: "PUSH_AUTHENTICATION", actions: [] });
    await setupNotificationCategories();
    expect(channel).toHaveBeenCalledTimes(os === "android" ? 1 : 0);
    expect(category).toHaveBeenCalledWith("PUSH_AUTHENTICATION", [
      expect.objectContaining({
        identifier: "ACCEPT",
        options: {
          opensAppToForeground: false,
          isAuthenticationRequired: true,
        },
      }),
      expect.objectContaining({
        identifier: "DECLINE",
        options: { opensAppToForeground: false, isDestructive: true },
      }),
    ]);
  },
);
test("foreground and background listeners deliver only valid messages", async () => {
  const handler = jest.fn();
  const unsubscribe = jest.fn();
  jest.mocked(onMessage).mockReturnValue(unsubscribe);
  expect(addMessageListener(handler)).toBe(unsubscribe);
  addBackgroundMessageHandler(handler);
  expect(getMessaging).toHaveBeenCalled();
  const foreground = jest.mocked(onMessage).mock.calls[0][1];
  const background = jest.mocked(setBackgroundMessageHandler).mock.calls[0][1];
  await foreground(message);
  await foreground({});
  await background(message);
  await background({});
  expect(handler).toHaveBeenCalledTimes(2);
});
test("dispatches known notification actions and removes listener", () => {
  const remove = jest.fn();
  const subscribe = jest
    .spyOn(Notifications, "addNotificationResponseReceivedListener")
    .mockReturnValue({ remove });
  const handler = jest.fn();
  const cleanup = setupForegroundNotificationHandler(handler);
  subscribe.mock.calls[0][0](notificationResponse());
  subscribe.mock.calls[0][0](notificationResponse("unknown"));
  expect(handler).toHaveBeenCalledTimes(1);
  expect(handler).toHaveBeenCalledWith(
    "ACCEPT",
    notificationResponse().notification,
  );
  cleanup();
  expect(remove).toHaveBeenCalledTimes(1);
});
test("cancels one or all notifications", async () => {
  const all = jest
    .spyOn(Notifications, "cancelAllScheduledNotificationsAsync")
    .mockResolvedValue(undefined);
  const one = jest
    .spyOn(Notifications, "cancelScheduledNotificationAsync")
    .mockResolvedValue(undefined);
  await cancelNotification("notification");
  await cancelAllNotifications();
  expect(one).toHaveBeenCalledWith("notification");
  expect(all).toHaveBeenCalledTimes(1);
});
