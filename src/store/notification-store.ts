import { notificationPermissionOptions } from "@/constants/notification";
import { setupNotificationCategories } from "@/utils/notification";
import {
  getMessaging,
  getToken,
  onTokenRefresh,
} from "@react-native-firebase/messaging";
import * as Notifications from "expo-notifications";
import { create } from "zustand";

type NotificationPermissionResult = {
  status: Notifications.NotificationPermissionsStatus;
  token: string | null;
};

type NotificationState = {
  fcmToken: string | null;
  isInitialized: boolean;
  isInitializing: boolean;
  permissionStatus: Notifications.NotificationPermissionsStatus | null;
};

type NotificationActions = {
  initialize: () => Promise<string | null>;
  checkPermissions: () => Promise<Notifications.NotificationPermissionsStatus | null>;
  getFcmToken: () => Promise<string | null>;
  requestPermissions: () => Promise<Notifications.NotificationPermissionsStatus | null>;
  reset: () => void;
};

type NotificationStore = NotificationState & NotificationActions;

// Keep track of token refresh unsubscribe function
let tokenRefreshUnsubscribe: (() => void) | null = null;
let initializationPromise: Promise<string | null> | null = null;

async function getNotificationPermissions(
  shouldRequest: boolean,
): Promise<Notifications.NotificationPermissionsStatus> {
  if (shouldRequest) {
    return await Notifications.requestPermissionsAsync(
      notificationPermissionOptions,
    );
  }

  return await Notifications.getPermissionsAsync();
}

async function getCurrentFcmToken(): Promise<string | null> {
  await setupNotificationCategories();
  return await getToken(getMessaging());
}

function subscribeToTokenRefresh(setFcmToken: (token: string) => void) {
  tokenRefreshUnsubscribe?.();
  tokenRefreshUnsubscribe = onTokenRefresh(getMessaging(), (newToken) => {
    console.log("FCM Token refreshed:", newToken);
    setFcmToken(newToken);
  });
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  fcmToken: null,
  isInitialized: false,
  isInitializing: false,
  permissionStatus: null,

  checkPermission: async () => {
    const settings = await Notifications.getPermissionsAsync();
    set({ permissionStatus: settings });

    if (!isNotificationPermissionEnabled(settings)) {
      set({ fcmToken: null });
    }

    return settings;
  },

  /**
   * Initialize notification system - should only be called once at app startup
   * Sets up permissions, notification categories, and FCM token
   */
  initialize: async () => {
    const { isInitialized, isInitializing } = get();

    // Prevent duplicate initialization
    if (isInitialized) {
      console.log(
        "Notification system already initialized, returning cached token",
      );
      return get().fcmToken;
    }

    if (isInitializing && initializationPromise) {
      console.log("Notification system already initializing, awaiting token");
      return await initializationPromise;
    }

    set({ isInitializing: true });

    initializationPromise = (async () => {
      const settings = await getNotificationPermissions(true);
      const token = await getCurrentFcmToken();

      if (!token) {
        console.warn("Failed to get FCM token");
        set({
          fcmToken: null,
          isInitializing: false,
          isInitialized: true,
          permissionStatus: settings,
        });
        return null;
      }

      console.log("FCM Token:", token);

      set({
        fcmToken: token,
        isInitialized: true,
        isInitializing: false,
        permissionStatus: settings,
      });

      subscribeToTokenRefresh((newToken) => set({ fcmToken: newToken }));

      return token;
    })();

    try {
      return await initializationPromise;
    } catch (error) {
      console.error("Error initializing notifications:", error);
      set({ isInitializing: false, isInitialized: true });
      return null;
    } finally {
      initializationPromise = null;
    }
  },

  checkPermissions: async () => {
    try {
      const settings = await getNotificationPermissions(false);
      const token = await getCurrentFcmToken();

      set({ fcmToken: token, permissionStatus: settings });

      return settings;
    } catch (error) {
      console.error("Error refreshing notification permissions:", error);
      return null;
    }
  },

  /**
   * Get the FCM token, initializing if necessary
   * This is the primary method to use when you need the FCM token
   */
  getFcmToken: async () => {
    const { fcmToken, isInitialized, initialize } = get();

    // If already initialized and have a token, return it
    if (isInitialized && fcmToken) {
      return fcmToken;
    }

    // If not initialized, initialize first
    if (!isInitialized) {
      return await initialize();
    }

    // If initialized but no token (permissions denied), try to get it anyway
    // in case user granted permissions later
    await get().checkPermissions();
    return get().fcmToken;
  },

  requestPermissions: async () => {
    const settings = await getNotificationPermissions(true);
    set({ permissionStatus: settings });
    return settings;
  },

  reset: () => {
    if (tokenRefreshUnsubscribe) {
      tokenRefreshUnsubscribe();
      tokenRefreshUnsubscribe = null;
    }
    set({
      fcmToken: null,
      isInitialized: false,
      isInitializing: false,
      permissionStatus: null,
    });
  },
}));
