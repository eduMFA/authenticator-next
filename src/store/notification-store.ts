import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import {
  AuthorizationStatus,
  getMessaging,
  getToken,
  onTokenRefresh,
  requestPermission,
} from "@react-native-firebase/messaging";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { create } from "zustand";

type NotificationState = {
  fcmToken: string | null;
  isInitialized: boolean;
  isInitializing: boolean;
  permissionStatus: number | null;
};

type NotificationActions = {
  initialize: () => Promise<string | null>;
  getFcmToken: () => Promise<string | null>;
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

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  fcmToken: null,
  isInitialized: false,
  isInitializing: false,
  permissionStatus: null,

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
      const authStatus = await requestPermission(messaging);
      const enabled =
        authStatus === AuthorizationStatus.AUTHORIZED ||
        authStatus === AuthorizationStatus.PROVISIONAL;

      set({ permissionStatus: authStatus });

      if (!enabled) {
        console.warn("Failed to get push notification permissions");
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
