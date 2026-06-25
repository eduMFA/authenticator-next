import type { PushRequest } from "@/types/push-request";

export type ChallengePollingResult = {
  success: boolean;
  challenges: PushRequest[];
  tokenResults?: TokenChallengePollingResult[];
  error?: Error;
};

export type TokenChallengePollingResult = {
  tokenId: string;
  success: boolean;
  error?: Error;
};
