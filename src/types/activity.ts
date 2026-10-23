export enum ActivityType {
  EnrollmentStarted = "enrollment_started",
  EnrollmentCompleted = "enrollment_completed",
  EnrollmentFailed = "enrollment_failed",
  PushReceived = "push_received",
  PushApproved = "push_approved",
  PushDenied = "push_denied",
}

export type Activity = {
  id: string;
  tokenId: string;
  type: ActivityType;
  timestamp: number;
  pushRequestId?: string;
  title?: string;
};
