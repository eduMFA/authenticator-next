export type PushRequest = {
  id: string;
  status: PushRequestStatus;
  sentAt: number;
  nonce: string;
  question: string;
  serial: string;
  signature: string;
  sslverify: string;
  title: string;
  url: string;
};

export type PushRequestData = {
  nonce: string;
  question: string;
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
  Expired = "expired",
}
