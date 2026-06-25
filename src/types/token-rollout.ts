import type { PushToken, PushTokenRolloutState } from "@/types/token";

export type RolloutStateUpdater = (
  id: string,
  update: Partial<PushToken>,
) => void;

export type TokenGetter = () => PushToken[];

export type RolloutResult = {
  success: boolean;
  serverPublicKey?: string;
  error?: Error;
  failedState?: PushTokenRolloutState;
};
