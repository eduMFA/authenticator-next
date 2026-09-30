import { deferred } from "./fixtures";
import { useNotificationStore } from "@/stores/notification";
import { setupNotificationCategories } from "@/utils/notification";
import {
  getToken,
  isSupported,
  onTokenRefresh,
} from "@react-native-firebase/messaging";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";

jest.mock("@/utils/notification", () => ({
  setupNotificationCategories: jest.fn(),
}));
jest.mock("@react-native-firebase/messaging", () => ({
  getMessaging: jest.fn(() => "messaging"),
  getToken: jest.fn(),
  isSupported: jest.fn(),
  onTokenRefresh: jest.fn(),
}));
const permission: Notifications.NotificationPermissionsStatus = {
  status: Notifications.PermissionStatus.GRANTED,
  granted: true,
  expires: "never",
  canAskAgain: true,
};
const unsubscribe = jest.fn();
beforeEach(() => {
  useNotificationStore.getState().reset();
  jest.replaceProperty(Platform, "OS", "android");
  jest.replaceProperty(Device, "isDevice", true);
  jest.mocked(getToken).mockReset().mockResolvedValue("fcm");
  jest.mocked(isSupported).mockResolvedValue(true);
  jest.mocked(onTokenRefresh).mockReturnValue(unsubscribe);
  jest
    .spyOn(Notifications, "getPermissionsAsync")
    .mockResolvedValue(permission);
  jest
    .spyOn(Notifications, "requestPermissionsAsync")
    .mockResolvedValue(permission);
});
afterEach(() => useNotificationStore.getState().reset());

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
  });
});
test("shares in-flight initialization", async () => {
  const pendingToken = deferred<string>();
  const registrationStarted = deferred<void>();
  jest.mocked(getToken).mockImplementation(() => {
    registrationStarted.resolve();
    return pendingToken.promise;
  });
  const first = useNotificationStore.getState().initialize();
  const second = useNotificationStore.getState().initialize();
  await registrationStarted.promise;
  pendingToken.resolve("fcm");
  expect(await Promise.all([first, second])).toEqual(["fcm", "fcm"]);
  expect(getToken).toHaveBeenCalledTimes(1);
});
test.each(["ios-simulator", "google-play-services-unavailable"] as const)(
  "reports capability %s without registering",
  async (capability) => {
    if (capability === "ios-simulator") {
      jest.replaceProperty(Platform, "OS", "ios");
      jest.replaceProperty(Device, "isDevice", false);
    } else {
      jest.mocked(isSupported).mockResolvedValue(false);
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
  expect(isSupported).not.toHaveBeenCalled();
});
test("retries registration when initialized without a token", async () => {
  jest.mocked(getToken).mockResolvedValueOnce("");
  expect(await useNotificationStore.getState().initialize()).toBeNull();
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
test("handles initialization and permission errors", async () => {
  jest
    .mocked(Notifications.getPermissionsAsync)
    .mockRejectedValue(new Error("unavailable"));
  expect(await useNotificationStore.getState().initialize()).toBeNull();
  expect(useNotificationStore.getState()).toMatchObject({
    isInitialized: true,
    isInitializing: false,
  });
  expect(await useNotificationStore.getState().checkPermissions()).toBeNull();
});
