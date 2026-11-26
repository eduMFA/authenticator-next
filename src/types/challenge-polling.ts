import type { PushRequest } from "@/types/push-request";
import type { PushToken } from "@/types/token";

export type ChallengePollingResult = {
  success: boolean;
  challenges: PushRequest[];
  tokenResults?: TokenChallengePollingResult[];
  tokenUpdate?: Partial<PushToken>;
  error?: Error;
};

export type TokenChallengePollingResult = {
  tokenId: string;
  success: boolean;
  tokenUpdate?: Partial<PushToken>;
  error?: Error;
};
