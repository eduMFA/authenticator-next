export type PushToken = {
  id: string;
  version: number;
  label: string;
  issuer?: string;
  callbackUrl: string;
  ttl: number;
  enrollmentCredential: string;
  sslVerify: boolean;
  imageUrl?: string;
  pin?: boolean;
  rolloutState: PushTokenRolloutState;
  publicKey?: string;
  serverPublicKey?: string;
};

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

export enum PushTokenRolloutState {
  Pending,
  RSAKeyGeneration,
  RSAKeyGenerationFailed,
  SendRSAPublicKey,
  SendRSAPublicKeyFailed,
  ParsingResponse,
  ParsingResponseFailed,
  Completed,
}

export namespace PushTokenRolloutState {
  export function isFailed(state: PushTokenRolloutState): boolean {
    return [
      PushTokenRolloutState.RSAKeyGenerationFailed,
      PushTokenRolloutState.SendRSAPublicKeyFailed,
      PushTokenRolloutState.ParsingResponseFailed,
    ].includes(state);
  }

  export function isFinished(state: PushTokenRolloutState): boolean {
    return state === PushTokenRolloutState.Completed || isFailed(state);
  }

  export function needsRollout(state: PushTokenRolloutState): boolean {
    return state !== PushTokenRolloutState.Completed && !isFailed(state);
  }

  export function getProgress(state: PushTokenRolloutState): number {
    switch (state) {
      case PushTokenRolloutState.Pending:
        return 0;
      case PushTokenRolloutState.RSAKeyGeneration:
        return 40;
      case PushTokenRolloutState.SendRSAPublicKey:
        return 70;
      case PushTokenRolloutState.ParsingResponse:
        return 90;
      case PushTokenRolloutState.Completed:
        return 100;
      default:
        return 100;
    }
  }
}
