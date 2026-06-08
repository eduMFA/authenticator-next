import { TOKEN_ROLLOUT_PROGRESS } from "@/constants/token";

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
        return TOKEN_ROLLOUT_PROGRESS.pending;
      case PushTokenRolloutState.RSAKeyGeneration:
        return TOKEN_ROLLOUT_PROGRESS.rsaKeyGeneration;
      case PushTokenRolloutState.SendRSAPublicKey:
        return TOKEN_ROLLOUT_PROGRESS.sendRsaPublicKey;
      case PushTokenRolloutState.ParsingResponse:
        return TOKEN_ROLLOUT_PROGRESS.parsingResponse;
      case PushTokenRolloutState.Completed:
        return TOKEN_ROLLOUT_PROGRESS.completed;
      default:
        return TOKEN_ROLLOUT_PROGRESS.completed;
    }
  }
}
