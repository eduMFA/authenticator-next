import type { PushRequest, PushRequestData } from "@/types/push-request";
import type * as Notifications from "expo-notifications";

export type NotificationAction = "ACCEPT" | "DECLINE" | "TAP";

export type NotificationResponseData = {
  nonce?: string;
  pushRequestId?: string;
} & Partial<PushRequestData>;

export type PushRequestHandler = (pushRequest: PushRequest) => void;

export type NotificationActionHandler = (
  actionId: string,
  notification: Notifications.Notification,
) => void;
