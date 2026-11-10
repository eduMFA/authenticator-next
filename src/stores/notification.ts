import { notificationPermissionOptions } from "@/constants/notification";
import { useSettingsStore } from "@/stores/settings";
import type {
  PushNotificationCapability,
  PushRegistrationStatus,
} from "@/types/notification";
import { setupNotificationCategories } from "@/utils/notification";
import { i18n } from "@lingui/core";
import { getUtils } from "@react-native-firebase/app";
import {
  getMessaging,
  getToken,
  isDeviceRegisteredForRemoteMessages,
  onTokenRefresh,
  registerDeviceForRemoteMessages,
} from "@react-native-firebase/messaging";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { create } from "zustand";

type PermissionStatus = Notifications.NotificationPermissionsStatus;

type NotificationState = {
  fcmToken: string | null;
  isInitialized: boolean;
  isInitializing: boolean;
  permissionStatus: PermissionStatus | null;
  pushCapability: PushNotificationCapability | null;
  registrationStatus: PushRegistrationStatus;
};

type NotificationActions = {
  initialize: () => Promise<string | null>;
  checkPermissions: () => Promise<PermissionStatus | null>;
  getFcmToken: () => Promise<string | null>;
  requestPermissions: () => Promise<PermissionStatus | null>;
  reset: () => void;
};

const initialState: NotificationState = {
  fcmToken: null,
  isInitialized: false,
  isInitializing: false,
  permissionStatus: null,
  pushCapability: null,
  registrationStatus: "idle",
};

// Google Play Services ConnectionResult codes that require a change to the
// device setup before push can work.
const GOOGLE_PLAY_SERVICES_MISSING = 1;
const GOOGLE_PLAY_SERVICES_DISABLED = 3;
const GOOGLE_PLAY_SERVICES_INVALID = 9;

async function getPushCapability(): Promise<{
  capability: PushNotificationCapability | null;
  canRegister: boolean;
}> {
  if (Platform.OS === "ios" && !Device.isDevice) {
    return { capability: "ios-simulator", canRegister: false };
  }

  if (Platform.OS === "android") {
    try {
      const status = await getUtils().getPlayServicesStatus();
      if (
        status.status === GOOGLE_PLAY_SERVICES_MISSING ||
        status.status === GOOGLE_PLAY_SERVICES_DISABLED ||
        status.status === GOOGLE_PLAY_SERVICES_INVALID
      ) {
        return {
          capability: "google-play-services-unavailable",
          canRegister: false,
        };
      }
      return { capability: "supported", canRegister: status.isAvailable };
    } catch (error) {
      console.warn(
        "Could not determine Google Play services availability.",
        error,
      );
      return { capability: null, canRegister: false };
    }
  }

  return { capability: "supported", canRegister: true };
}

async function getNotificationPermissions() {
  try {
    return await Notifications.getPermissionsAsync();
  } catch (error) {
    console.warn("Could not read notification permissions.", error);
    return null;
  }
}

function hasExistingPermissionDecision(settings: PermissionStatus | null) {
  if (!settings) return false;
  if (Platform.OS === "ios") {
    return settings.status !== Notifications.PermissionStatus.UNDETERMINED;
  }
  // Android versions without a runtime prompt grant permission by default.
  return (
    Platform.OS === "android" &&
    Number(Platform.Version) >= 33 &&
    (settings.granted || !settings.canAskAgain)
  );
}

export const useNotificationStore = create<
  NotificationState & NotificationActions
>((set, get) => {
  let refreshPromise: Promise<PermissionStatus | null> | null = null;
  let requestPromise: Promise<PermissionStatus | null> | null = null;
  let tokenRefreshUnsubscribe: (() => void) | null = null;
  let categories: { locale: string; promise: Promise<void> } | null = null;

  function prepareNotificationCategories() {
    const locale = i18n.locale;
    if (categories?.locale === locale) return categories.promise;

    const promise = setupNotificationCategories().catch((error) => {
      if (categories?.promise === promise) categories = null;
      console.warn("Could not configure notification actions.", error);
    });
    categories = { locale, promise };
    return promise;
  }

  function refreshNotifications(settings?: PermissionStatus) {
    if (refreshPromise) return refreshPromise;

    const refresh: Promise<PermissionStatus | null> = Promise.all([
      settings ?? getNotificationPermissions(),
      getPushCapability(),
    ])
      .then(
        async ([
          permissionStatus,
          { capability: pushCapability, canRegister },
        ]) => {
          if (refreshPromise !== refresh) return null;

          const { hasRequestedNotificationPermissions } =
            useSettingsStore.getState();
          const mayRegister =
            hasRequestedNotificationPermissions ||
            hasExistingPermissionDecision(permissionStatus);
          if (mayRegister && !hasRequestedNotificationPermissions) {
            useSettingsStore.setState({
              hasRequestedNotificationPermissions: true,
            });
          }
          if (
            pushCapability === "ios-simulator" ||
            pushCapability === "google-play-services-unavailable"
          ) {
            tokenRefreshUnsubscribe?.();
            tokenRefreshUnsubscribe = null;
            set({
              fcmToken: null,
              permissionStatus,
              pushCapability,
              registrationStatus: "unavailable",
            });
          } else if (!mayRegister) {
            set({
              permissionStatus,
              pushCapability,
              registrationStatus: "idle",
            });
          } else if (!canRegister) {
            set({
              fcmToken: null,
              permissionStatus,
              pushCapability,
              registrationStatus: "failed",
            });
          } else {
            set({
              permissionStatus,
              pushCapability,
              registrationStatus: "pending",
            });
            try {
              await prepareNotificationCategories();
              if (refreshPromise !== refresh) return null;
              const messaging = getMessaging();
              if (
                Platform.OS === "ios" &&
                !isDeviceRegisteredForRemoteMessages(messaging)
              ) {
                await registerDeviceForRemoteMessages(messaging);
              }
              if (refreshPromise !== refresh) return null;
              const token = await getToken(messaging);
              if (refreshPromise !== refresh) return null;
              set({
                fcmToken: token || null,
                registrationStatus: token ? "registered" : "failed",
              });
            } catch (error) {
              console.warn(
                "Push registration unavailable; using polling.",
                error,
              );
              if (refreshPromise !== refresh) return null;
              set({ registrationStatus: "failed" });
            }

            try {
              tokenRefreshUnsubscribe ??= onTokenRefresh(
                getMessaging(),
                (token) => {
                  set({
                    fcmToken: token,
                    pushCapability: "supported",
                    registrationStatus: "registered",
                  });
                },
              );
            } catch (error) {
              console.warn("Could not subscribe to FCM token changes.", error);
            }
          }

          return permissionStatus;
        },
      )
      .finally(() => {
        if (refreshPromise === refresh) {
          refreshPromise = null;
          set({ isInitialized: true, isInitializing: false });
        }
      });
    refreshPromise = refresh;
    set({ isInitializing: true });
    return refresh;
  }

  return {
    ...initialState,
    initialize: async () => {
      if (!get().isInitialized) await refreshNotifications();
      return get().fcmToken;
    },
    checkPermissions: () => refreshNotifications(),
    getFcmToken: async () => {
      if (!get().fcmToken) await refreshNotifications();
      return get().fcmToken;
    },
    requestPermissions: () => {
      requestPromise ??= (async () => {
        // Android needs a notification channel before requesting permission.
        await prepareNotificationCategories();
        const settings = await Notifications.requestPermissionsAsync(
          notificationPermissionOptions,
        );
        useSettingsStore.setState({
          hasRequestedNotificationPermissions: true,
        });
        await refreshPromise;
        if (get().fcmToken) {
          set({ permissionStatus: settings });
          return settings;
        }
        return refreshNotifications(settings);
      })().finally(() => {
        requestPromise = null;
      });
      return requestPromise;
    },
    reset: () => {
      refreshPromise = null;
      categories = null;
      tokenRefreshUnsubscribe?.();
      tokenRefreshUnsubscribe = null;
      set(initialState);
    },
  };
});
