import {
  PUSH_AUTHENTICATION_CATEGORY,
  PUSH_AUTHENTICATION_CHANNEL,
} from "@/constants/notification";
import { activateCurrentLocale } from "@/utils/locale";
import {
  addBackgroundMessageHandler,
  setupNotificationCategories,
} from "@/utils/notification";
import { PushRequestStatus } from "@/types/push-request";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { receivePushRequest } from "./push-notification";
import { synchronizeNotificationState } from "./notification-state";

export function registerBackgroundNotifications(): void {
  addBackgroundMessageHandler(async (request) => {
    try {
      const verified = await receivePushRequest(request);
      if (
        Platform.OS !== "android" ||
        !verified ||
        verified.status !== PushRequestStatus.Pending ||
        Date.now() - verified.sentAt >= 120_000
      )
        return;

      activateCurrentLocale();
      await setupNotificationCategories();
      await Notifications.scheduleNotificationAsync({
        identifier: verified.id,
        content: {
          title: verified.title,
          body: verified.question,
          data: { ...verified, pushRequestId: verified.id },
          categoryIdentifier: PUSH_AUTHENTICATION_CATEGORY,
          sound: "default",
        },
        trigger: { channelId: PUSH_AUTHENTICATION_CHANNEL },
      });
      await synchronizeNotificationState();
    } catch (error) {
      console.error("Background notification failed:", error);
    }
  });
}
