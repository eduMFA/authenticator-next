import { deferred } from "./fixtures";
import { useNotificationStore } from "@/stores/notification";
import { useSettingsStore } from "@/stores/settings";
import { setupNotificationCategories } from "@/utils/notification";
import { getUtils, type Utils } from "@react-native-firebase/app";
import {
  getMessaging,
  getToken,
  onTokenRefresh,
  registerDeviceForRemoteMessages,
} from "@react-native-firebase/messaging";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";

jest.mock("@/utils/sentry", () => ({ setSentryTrackingEnabled: jest.fn() }));
jest.mock("react-native-pulsar", () => ({
  Settings: { enableHaptics: jest.fn() },
}));
jest.mock("@/utils/notification", () => ({
  setupNotificationCategories: jest.fn(),
}));
jest.mock("@react-native-firebase/app", () => ({
  getUtils: jest.fn(() => ({
    getPlayServicesStatus: mockGetPlayServicesStatus,
  })),
}));
jest.mock("@react-native-firebase/messaging", () => ({
  getMessaging: jest.fn(() => "messaging"),
  getToken: jest.fn(),
  isDeviceRegisteredForRemoteMessages: jest.fn(() => false),
  onTokenRefresh: jest.fn(),
  registerDeviceForRemoteMessages: jest.fn(),
}));
const mockGetPlayServicesStatus = jest.fn<
  Promise<Utils.PlayServicesAvailability>,
  []
>();
function availability(
  status: Utils.PlayServicesAvailabilityStatusCodes,
): Utils.PlayServicesAvailability {
  return {
    status,
    isAvailable: status === 0,
    hasResolution: false,
    isUserResolvableError: false,
    error: undefined,
  };
}
const permission: Notifications.NotificationPermissionsStatus = {
  status: Notifications.PermissionStatus.GRANTED,
  granted: true,
  expires: "never",
  canAskAgain: true,
};
const unsubscribe = jest.fn();
beforeEach(async () => {
  await useSettingsStore.persist.rehydrate();
  useSettingsStore.setState({ hasRequestedNotificationPermissions: true });
  useNotificationStore.getState().reset();
  jest.replaceProperty(Platform, "OS", "android");
  jest.replaceProperty(Device, "isDevice", true);
  jest.mocked(getToken).mockReset().mockResolvedValue("fcm");
  jest.mocked(setupNotificationCategories).mockResolvedValue(undefined);
  mockGetPlayServicesStatus.mockReset().mockResolvedValue(availability(0));
  jest.mocked(onTokenRefresh).mockReturnValue(unsubscribe);
  jest
    .spyOn(Notifications, "getPermissionsAsync")
    .mockResolvedValue(permission);
  jest
    .spyOn(Notifications, "requestPermissionsAsync")
    .mockResolvedValue(permission);
});
afterEach(() => useNotificationStore.getState().reset());

test("startup, foreground checks, and enrollment leave FCM off before a permission request", async () => {
  useSettingsStore.setState({ hasRequestedNotificationPermissions: false });
  jest.replaceProperty(Platform, "OS", "ios");
  const undetermined = {
    ...permission,
    status: Notifications.PermissionStatus.UNDETERMINED,
    granted: false,
  };
  jest
    .mocked(Notifications.getPermissionsAsync)
    .mockResolvedValue(undetermined);
  const store = useNotificationStore.getState();
  expect(await store.initialize()).toBeNull();
  expect(await store.checkPermissions()).toEqual(undetermined);
  expect(await store.getFcmToken()).toBeNull();
  expect(useNotificationStore.getState().registrationStatus).toBe("idle");
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  expect(getMessaging).not.toHaveBeenCalled();
  expect(setupNotificationCategories).not.toHaveBeenCalled();
});

test("a denied first request unlocks FCM and is remembered across launches", async () => {
  useSettingsStore.setState({ hasRequestedNotificationPermissions: false });
  jest.replaceProperty(Platform, "OS", "ios");
  const denied = {
    ...permission,
    status: Notifications.PermissionStatus.DENIED,
    granted: false,
  };
  const pendingPermission =
    deferred<Notifications.NotificationPermissionsStatus>();
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
    ...denied,
    status: Notifications.PermissionStatus.UNDETERMINED,
  });
  jest
    .mocked(Notifications.requestPermissionsAsync)
    .mockReturnValue(pendingPermission.promise);
  const store = useNotificationStore.getState();
  const request = store.requestPermissions();
  expect(store.requestPermissions()).toBe(request);
  expect(await store.checkPermissions()).not.toEqual(denied);
  expect(getMessaging).not.toHaveBeenCalled();
  pendingPermission.resolve(denied);
  expect(await request).toEqual(denied);
  expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  expect(registerDeviceForRemoteMessages).toHaveBeenCalledTimes(1);
  expect(getToken).toHaveBeenCalledTimes(1);
  store.reset();
  await useSettingsStore.persist.rehydrate();
  expect(await store.initialize()).toBe("fcm");
});

test("the default notification grant on older Android versions leaves FCM off", async () => {
  useSettingsStore.setState({ hasRequestedNotificationPermissions: false });
  jest.spyOn(Platform, "Version", "get").mockReturnValue(32);
  expect(await useNotificationStore.getState().initialize()).toBeNull();
  expect(getMessaging).not.toHaveBeenCalled();
});

test("Android reports notifications as denied before the first prompt", async () => {
  useSettingsStore.setState({ hasRequestedNotificationPermissions: false });
  jest.spyOn(Platform, "Version", "get").mockReturnValue(33);
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
    ...permission,
    status: Notifications.PermissionStatus.DENIED,
    granted: false,
  });
  expect(await useNotificationStore.getState().initialize()).toBeNull();
  expect(getMessaging).not.toHaveBeenCalled();
});

test("preserves registration for an existing iOS permission decision", async () => {
  useSettingsStore.setState({ hasRequestedNotificationPermissions: false });
  jest.replaceProperty(Platform, "OS", "ios");
  expect(await useNotificationStore.getState().initialize()).toBe("fcm");
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
});

test("initializes once, caches token, and handles refresh and reset", async () => {
  const store = useNotificationStore.getState();
  expect(await store.getFcmToken()).toBe("fcm");
  expect(await store.initialize()).toBe("fcm");
  expect(await store.getFcmToken()).toBe("fcm");
  expect(getToken).toHaveBeenCalledTimes(1);
  expect(setupNotificationCategories).toHaveBeenCalledTimes(1);
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  const refresh = jest.mocked(onTokenRefresh).mock.calls[0][1];
  refresh("refreshed");
  expect(useNotificationStore.getState().fcmToken).toBe("refreshed");
  store.reset();
  expect(unsubscribe).toHaveBeenCalled();
  expect(useNotificationStore.getState()).toMatchObject({
    fcmToken: null,
    isInitialized: false,
    isInitializing: false,
    permissionStatus: null,
    pushCapability: null,
    registrationStatus: "idle",
  });
});
test("startup, foreground checks, and enrollment share in-flight registration", async () => {
  const pendingToken = deferred<string>();
  const registrationStarted = deferred<void>();
  jest.mocked(getToken).mockImplementation(() => {
    registrationStarted.resolve();
    return pendingToken.promise;
  });
  const first = useNotificationStore.getState().initialize();
  const second = useNotificationStore.getState().initialize();
  const permissions = useNotificationStore.getState().checkPermissions();
  const enrollment = useNotificationStore.getState().getFcmToken();
  await registrationStarted.promise;
  pendingToken.resolve("fcm");
  expect(await Promise.all([first, second, enrollment, permissions])).toEqual([
    "fcm",
    "fcm",
    "fcm",
    permission,
  ]);
  expect(getToken).toHaveBeenCalledTimes(1);
});
test.each(["ios-simulator", "google-play-services-unavailable"] as const)(
  "reports capability %s without registering",
  async (capability) => {
    if (capability === "ios-simulator") {
      jest.replaceProperty(Platform, "OS", "ios");
      jest.replaceProperty(Device, "isDevice", false);
    } else {
      mockGetPlayServicesStatus.mockResolvedValue(availability(1));
    }
    expect(await useNotificationStore.getState().initialize()).toBeNull();
    expect(useNotificationStore.getState().pushCapability).toBe(capability);
    expect(getToken).not.toHaveBeenCalled();
    expect(onTokenRefresh).not.toHaveBeenCalled();
  },
);
test("supports physical iOS devices", async () => {
  jest.replaceProperty(Platform, "OS", "ios");
  expect(await useNotificationStore.getState().initialize()).toBe("fcm");
  expect(getUtils).not.toHaveBeenCalled();
});
test("denied notification permission does not make an iPhone unsupported", async () => {
  jest.replaceProperty(Platform, "OS", "ios");
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
    ...permission,
    granted: false,
    status: Notifications.PermissionStatus.DENIED,
  });
  expect(await useNotificationStore.getState().initialize()).toBe("fcm");
  expect(useNotificationStore.getState()).toMatchObject({
    pushCapability: "supported",
    registrationStatus: "registered",
    permissionStatus: { granted: false },
  });
});
test("a notification category setup failure does not make the device unsupported", async () => {
  jest
    .mocked(setupNotificationCategories)
    .mockRejectedValueOnce(new Error("category setup failed"));
  expect(await useNotificationStore.getState().initialize()).toBe("fcm");
  expect(useNotificationStore.getState()).toMatchObject({
    pushCapability: "supported",
    registrationStatus: "registered",
  });
});
test.each([1, 3, 9] as const)(
  "uses polling without opening Firebase Messaging for Play Services status %s",
  async (status) => {
    mockGetPlayServicesStatus.mockResolvedValue(availability(status));
    expect(await useNotificationStore.getState().initialize()).toBeNull();
    expect(await useNotificationStore.getState().getFcmToken()).toBeNull();
    expect(useNotificationStore.getState()).toMatchObject({
      pushCapability: "google-play-services-unavailable",
      registrationStatus: "unavailable",
    });
    expect(getMessaging).not.toHaveBeenCalled();
  },
);
test("returns to push automatically when Google Play services become available", async () => {
  mockGetPlayServicesStatus.mockResolvedValueOnce(availability(3));
  expect(await useNotificationStore.getState().initialize()).toBeNull();
  expect(await useNotificationStore.getState().getFcmToken()).toBe("fcm");
  expect(useNotificationStore.getState().pushCapability).toBe("supported");
  expect(onTokenRefresh).toHaveBeenCalled();
});
test.each(["ios", "android"] as const)(
  "%s remains push-capable after a temporary registration failure",
  async (platform) => {
    jest.replaceProperty(Platform, "OS", platform);
    jest.mocked(getToken).mockRejectedValue(new Error("registration failed"));
    expect(await useNotificationStore.getState().initialize()).toBeNull();
    expect(useNotificationStore.getState()).toMatchObject({
      pushCapability: "supported",
      registrationStatus: "failed",
    });
    const refresh = jest.mocked(onTokenRefresh).mock.calls[0][1];
    refresh("recovered");
    expect(useNotificationStore.getState()).toMatchObject({
      fcmToken: "recovered",
      registrationStatus: "registered",
    });
  },
);
test.each([2, 18] as const)(
  "keeps push registration retryable for Play Services status %s",
  async (status) => {
    mockGetPlayServicesStatus.mockResolvedValue(availability(status));
    expect(await useNotificationStore.getState().initialize()).toBeNull();
    expect(useNotificationStore.getState()).toMatchObject({
      pushCapability: "supported",
      registrationStatus: "failed",
    });
    expect(getToken).not.toHaveBeenCalled();
  },
);
test("a failed Android capability check remains unknown and can be retried", async () => {
  mockGetPlayServicesStatus.mockRejectedValueOnce(
    new Error("native check failed"),
  );
  expect(await useNotificationStore.getState().initialize()).toBeNull();
  expect(useNotificationStore.getState()).toMatchObject({
    pushCapability: null,
    registrationStatus: "failed",
  });
  expect(await useNotificationStore.getState().getFcmToken()).toBe("fcm");
  expect(useNotificationStore.getState()).toMatchObject({
    pushCapability: "supported",
    registrationStatus: "registered",
  });
});
test("retries registration when initialized without a token", async () => {
  jest.mocked(getToken).mockResolvedValueOnce("");
  expect(await useNotificationStore.getState().initialize()).toBeNull();
  expect(useNotificationStore.getState()).toMatchObject({
    pushCapability: "supported",
    registrationStatus: "failed",
  });
  expect(await useNotificationStore.getState().getFcmToken()).toBe("fcm");
  expect(getToken).toHaveBeenCalledTimes(2);
});
test("refreshes permissions and requests display permission explicitly", async () => {
  expect(await useNotificationStore.getState().checkPermissions()).toEqual(
    permission,
  );
  expect(useNotificationStore.getState().fcmToken).toBe("fcm");
  expect(await useNotificationStore.getState().requestPermissions()).toEqual(
    permission,
  );
  expect(Notifications.requestPermissionsAsync).toHaveBeenCalledWith({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
      provideAppNotificationSettings: true,
    },
  });
});
test("refreshing registration subscribes to subsequent FCM token changes", async () => {
  await useNotificationStore.getState().checkPermissions();
  expect(onTokenRefresh).toHaveBeenCalledTimes(1);
  const refresh = jest.mocked(onTokenRefresh).mock.calls[0][1];
  refresh("refreshed-after-registration");
  expect(useNotificationStore.getState().fcmToken).toBe(
    "refreshed-after-registration",
  );
});
test("permission lookup errors do not change device capability or prevent registration", async () => {
  jest
    .mocked(Notifications.getPermissionsAsync)
    .mockRejectedValue(new Error("unavailable"));
  expect(await useNotificationStore.getState().initialize()).toBe("fcm");
  expect(useNotificationStore.getState()).toMatchObject({
    isInitialized: true,
    isInitializing: false,
    pushCapability: "supported",
    registrationStatus: "registered",
  });
  expect(await useNotificationStore.getState().checkPermissions()).toBeNull();
});
