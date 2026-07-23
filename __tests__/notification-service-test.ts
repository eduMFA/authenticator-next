jest.mock("@react-native-firebase/messaging", () => ({
  __esModule: true,
  getMessaging: jest.fn(() => "messaging"),
  onMessage: jest.fn(),
  setBackgroundMessageHandler: jest.fn(),
}));

jest.mock("expo-notifications", () => ({
  __esModule: true,
  DEFAULT_ACTION_IDENTIFIER: "default-action",
  IosAuthorizationStatus: { PROVISIONAL: 3 },
  PermissionStatus: { UNDETERMINED: "undetermined" },
  addNotificationResponseReceivedListener: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
}));

jest.mock("@lingui/core", () => ({
  __esModule: true,
  i18n: { _: (value: unknown) => value },
}));

import {
  getMessaging,
  onMessage,
  setBackgroundMessageHandler,
} from "@react-native-firebase/messaging";
import type { FirebaseMessagingTypes } from "@react-native-firebase/messaging";
import * as Notifications from "expo-notifications";

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
  validatePushRequestData,
} from "@/utils/notification";

const createRemoteMessage = (
  overrides: Record<string, unknown> = {},
): FirebaseMessagingTypes.RemoteMessage =>
  ({
    category: "PUSH_AUTHENTICATION",
    data: {
      nonce: "nonce-1",
      question: "Allow login?",
      serial: "PUSH0001",
      signature: "signature",
      sslverify: "1",
      title: "Login",
      url: "https://mfa.example.com/validate",
    },
    messageId: "message-1",
    sentTime: 1_000,
    ...overrides,
  }) as unknown as FirebaseMessagingTypes.RemoteMessage;

describe("notification service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("parses valid push authentication messages", () => {
    expect(parsePushRequest(createRemoteMessage())).toEqual({
      id: "message-1",
      nonce: "nonce-1",
      question: "Allow login?",
      sentAt: 1_000,
      serial: "PUSH0001",
      signature: "signature",
      sslverify: "1",
      status: "pending",
      title: "Login",
      url: "https://mfa.example.com/validate",
    });
  });

  test("uses fallback ids and timestamps", () => {
    jest.spyOn(Date, "now").mockReturnValue(2_000);

    expect(
      parsePushRequest(
        createRemoteMessage({
          messageId: undefined,
          sentTime: undefined,
        }),
      ),
    ).toMatchObject({
      id: "nonce-1-2000",
      sentAt: 2_000,
    });
  });

  test("rejects messages outside the push authentication shape", () => {
    expect(
      parsePushRequest(createRemoteMessage({ category: "OTHER" })),
    ).toBeNull();
    expect(parsePushRequest(createRemoteMessage({ data: undefined }))).toBeNull();
    expect(
      parsePushRequest(
        createRemoteMessage({
          data: {
            nonce: "nonce-1",
          },
        }),
      ),
    ).toBeNull();
  });

  test("validates and parses notification content data", () => {
    const data = createRemoteMessage().data;

    expect(validatePushRequestData(data)).toBe(true);
    expect(validatePushRequestData(null)).toBe(false);
    expect(validatePushRequestData({ ...data, title: 42 })).toBe(false);
    expect(
      parsePushRequestFromNotificationData(data, "fallback-id", 2_000),
    ).toMatchObject({
      id: "fallback-id",
      sentAt: 2_000,
      status: "pending",
    });
    expect(
      parsePushRequestFromNotificationData({ nonce: "incomplete" }, "id"),
    ).toBeNull();
  });

  test("normalizes notification actions and response metadata", () => {
    const response = {
      actionIdentifier: "ACCEPT",
      notification: {
        request: {
          identifier: "notification-1",
          content: { data: { nonce: "nonce-1" } },
        },
      },
    } as unknown as Notifications.NotificationResponse;

    expect(getNotificationAction("ACCEPT")).toBe("ACCEPT");
    expect(getNotificationAction("DECLINE")).toBe("DECLINE");
    expect(getNotificationAction(Notifications.DEFAULT_ACTION_IDENTIFIER)).toBe(
      "TAP",
    );
    expect(getNotificationAction("OTHER")).toBeNull();
    expect(getNotificationResponseData(response)).toEqual({ nonce: "nonce-1" });
    expect(getNotificationResponseKey(response)).toBe(
      "notification-1:ACCEPT",
    );
  });

  test("interprets notification permission states", () => {
    expect(isNotificationPermissionEnabled(null)).toBe(false);
    expect(
      isNotificationPermissionEnabled({ granted: true } as never),
    ).toBe(true);
    expect(isNotificationPermissionPending(null)).toBe(true);
    expect(
      isNotificationPermissionPending({
        status: "undetermined",
      } as never),
    ).toBe(true);
    expect(
      isNotificationPermissionPending({ status: "granted" } as never),
    ).toBe(false);
  });

  test("adds foreground message listeners", async () => {
    const unsubscribe = jest.fn();
    let messageCallback: ((message: ReturnType<typeof createRemoteMessage>) => void)
      | undefined;
    (onMessage as jest.Mock).mockImplementation((_messaging, callback) => {
      messageCallback = callback;
      return unsubscribe;
    });
    const handler = jest.fn();

    expect(addMessageListener(handler)).toBe(unsubscribe);

    expect(getMessaging).toHaveBeenCalled();
    await messageCallback?.(createRemoteMessage());
    await messageCallback?.(createRemoteMessage({ category: "OTHER" }));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ id: "message-1" }),
    );
  });

  test("adds background message handlers", async () => {
    let messageCallback: ((message: ReturnType<typeof createRemoteMessage>) => void)
      | undefined;
    (setBackgroundMessageHandler as jest.Mock).mockImplementation(
      (_messaging, callback) => {
        messageCallback = callback;
      },
    );
    const handler = jest.fn();

    addBackgroundMessageHandler(handler);
    await messageCallback?.(createRemoteMessage());

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ id: "message-1" }),
    );
  });

  test("normalizes foreground notification actions", () => {
    const remove = jest.fn();
    let notificationCallback:
      | ((response: {
          actionIdentifier: string;
          notification: { request: { identifier: string } };
        }) => void)
      | undefined;
    (
      Notifications.addNotificationResponseReceivedListener as jest.Mock
    ).mockImplementation((callback) => {
      notificationCallback = callback;
      return { remove };
    });
    const handler = jest.fn();

    const cleanup = setupForegroundNotificationHandler(handler);
    const notification = { request: { identifier: "notification-1" } };

    notificationCallback?.({ actionIdentifier: "ACCEPT", notification });
    notificationCallback?.({ actionIdentifier: "DECLINE", notification });
    notificationCallback?.({
      actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
      notification,
    });
    notificationCallback?.({ actionIdentifier: "OTHER", notification });
    cleanup();

    expect(handler).toHaveBeenCalledTimes(3);
    expect(handler).toHaveBeenNthCalledWith(1, "ACCEPT", notification);
    expect(handler).toHaveBeenNthCalledWith(2, "DECLINE", notification);
    expect(handler).toHaveBeenNthCalledWith(3, "TAP", notification);
    expect(remove).toHaveBeenCalled();
  });

  test("cancels notifications", async () => {
    await cancelAllNotifications();
    await cancelNotification("notification-1");

    expect(
      Notifications.cancelAllScheduledNotificationsAsync,
    ).toHaveBeenCalled();
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      "notification-1",
    );
  });
});
