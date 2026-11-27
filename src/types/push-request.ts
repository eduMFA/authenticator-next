export type PushRequest = PushRequestData & {
  id: string;
  status: PushRequestStatus;
  sentAt: number;
};

export type PushRequestData = {
  nonce: string;
  question?: string;
  serial: string;
  signature: string;
  sslverify: string;
  title: string;
  url: string;
};

export enum PushRequestStatus {
  Pending = "pending",
  Accepted = "accepted",
  Declined = "declined",
  Dismissed = "dismissed",
  Expired = "expired",
}
