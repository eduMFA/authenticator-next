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
  lastRefreshResult?: PushTokenRefreshResult;
};

export type PushTokenRefreshResult = {
  status: PushTokenRefreshStatus;
  timestamp: number;
  error?: string;
  errorType?: PushTokenRefreshErrorType;
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

export enum PushTokenRefreshStatus {
  Success = "success",
  Failed = "failed",
}

export enum PushTokenRefreshErrorType {
  Network = "network",
  Server = "server",
  Unknown = "unknown",
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
    return rolloutProgressByState[state];
  }
}

const rolloutProgressByState = {
  [PushTokenRolloutState.Pending]: 0,
  [PushTokenRolloutState.RSAKeyGeneration]: 40,
  [PushTokenRolloutState.RSAKeyGenerationFailed]: 100,
  [PushTokenRolloutState.SendRSAPublicKey]: 70,
  [PushTokenRolloutState.SendRSAPublicKeyFailed]: 100,
  [PushTokenRolloutState.ParsingResponse]: 90,
  [PushTokenRolloutState.ParsingResponseFailed]: 100,
  [PushTokenRolloutState.Completed]: 100,
} satisfies Record<PushTokenRolloutState, number>;
