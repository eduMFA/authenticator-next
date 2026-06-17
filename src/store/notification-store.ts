import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import {
  getMessaging,
  getToken,
  onTokenRefresh,
} from "@react-native-firebase/messaging";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
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
  checkPermission: () => Promise<Notifications.NotificationPermissionsStatus>;
  getFcmToken: () => Promise<string | null>;
  refreshPermissionStatus: () => Promise<Notifications.NotificationPermissionsStatus | null>;
  requestPermission: () => Promise<NotificationPermissionResult>;
  reset: () => void;
};

type NotificationStore = NotificationState & NotificationActions;

// Keep track of token refresh unsubscribe function
let tokenRefreshUnsubscribe: (() => void) | null = null;

/**
 * Configure notification categories with quick actions
 */
async function setupNotificationCategories() {
  // Create Android notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("push-auth", {
      name: "Push Authentication",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  // Set up notification categories with actions for both platforms
  await Notifications.setNotificationCategoryAsync("PUSH_AUTHENTICATION", [
    {
      identifier: "ACCEPT",
      buttonTitle: i18n._(t`Accept`),
      options: {
        opensAppToForeground: false,
        isAuthenticationRequired: true,
      },
    },
    {
      identifier: "DECLINE",
      buttonTitle: i18n._(t`Decline`),
      options: {
        opensAppToForeground: false,
        isDestructive: true,
      },
    },
  ]);
}

function isNotificationPermissionEnabled(
  settings: Notifications.NotificationPermissionsStatus,
): boolean {
  return (
    settings.granted ||
    settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
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
    if (isInitialized || isInitializing) {
      console.log(
        "Notification system already initialized or initializing, returning cached token",
      );
      return get().fcmToken;
    }

    set({ isInitializing: true });

    try {
      const messaging = getMessaging();

      // Request permission for iOS
      const settings = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          provideAppNotificationSettings: true,
        },
      });
      const enabled = isNotificationPermissionEnabled(settings);

      set({ permissionStatus: settings });

      if (!enabled) {
        console.warn("Push notification permissions are not enabled");
        set({ isInitializing: false, isInitialized: true });
        return null;
      }

      // Setup notification categories
      await setupNotificationCategories();

      // Get the FCM token
      const token = await getToken(messaging);
      console.log("FCM Token:", token);

      set({
        fcmToken: token,
        isInitialized: true,
        isInitializing: false,
      });

      // Set up token refresh listener
      if (tokenRefreshUnsubscribe) {
        tokenRefreshUnsubscribe();
      }

      tokenRefreshUnsubscribe = onTokenRefresh(messaging, (newToken) => {
        console.log("FCM Token refreshed:", newToken);
        set({ fcmToken: newToken });
      });

      return token;
    } catch (error) {
      console.error("Error initializing notifications:", error);
      set({ isInitializing: false, isInitialized: true });
      return null;
    }
  },

  requestPermission: async () => {
    set({ isInitializing: true });

    const settings = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        provideAppNotificationSettings: true,
      },
    });
    const enabled = isNotificationPermissionEnabled(settings);

    set({ permissionStatus: settings });

    if (!enabled) {
      set({
        fcmToken: null,
        isInitialized: true,
        isInitializing: false,
      });

      return { status: settings, token: null };
    }

    // Setup notification categories
    await setupNotificationCategories();

    // Get the FCM token
    const messaging = getMessaging();
    const token = await getToken(messaging);
    console.log("FCM Token:", token);

    set({
      fcmToken: token,
      isInitialized: true,
      isInitializing: false,
    });

    // Set up token refresh listener
    if (tokenRefreshUnsubscribe) {
      tokenRefreshUnsubscribe();
    }

    tokenRefreshUnsubscribe = onTokenRefresh(messaging, (newToken) => {
      console.log("FCM Token refreshed:", newToken);
      set({ fcmToken: newToken });
    });

    return { status: settings, token };
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

    const authStatus = await getCurrentPermissionStatus();
    set({ permissionStatus: authStatus });

    if (!hasNotificationPermission(authStatus)) {
      return null;
    }

    // If initialized but no token, try to get it in case permissions changed.
    try {
      const messaging = getMessaging();
      const token = await getToken(messaging);
      if (token) {
        set({ fcmToken: token });
      }
      return token;
    } catch (error) {
      console.error("Error getting FCM token:", error);
      return null;
    }
  },

  refreshPermissionStatus: async () => {
    try {
      const settings = await Notifications.getPermissionsAsync();
      const enabled = isNotificationPermissionEnabled(settings);

      set({ permissionStatus: settings });

      if (!enabled) {
        set({ fcmToken: null });
        return settings;
      }

      await setupNotificationCategories();

      const messaging = getMessaging();
      const token = await getToken(messaging);
      if (token) {
        set({ fcmToken: token });
      }

      return settings;
    } catch (error) {
      console.error("Error refreshing notification permissions:", error);
      return null;
    }
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
