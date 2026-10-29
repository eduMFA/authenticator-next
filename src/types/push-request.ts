export type PushChallengeType = "number";

export type PushRequestData = {
  challenge_type?: PushChallengeType;
  challenge_choices?: string;
  nonce: string;
  question: string;
  serial: string;
  signature: string;
  sslverify: string;
  title: string;
  url: string;
};

export type PushRequest = PushRequestData & {
  id: string;
  status: PushRequestStatus;
  sentAt: number;
  challenge_response?: string;
};

export enum PushRequestStatus {
  Pending = "pending",
  Accepted = "accepted",
  Declined = "declined",
  Expired = "expired",
  ChallengeMismatch = "challenge_mismatch",
}
