import type { PushRequest } from "@/types/push-request";

export type ChallengePollingResult = {
  success: boolean;
  challenges: PushRequest[];
  tokenResults?: TokenChallengePollingResult[];
  imageUrl?: string | null;
  error?: Error;
};

export type TokenChallengePollingResult = {
  tokenId: string;
  imageUrl?: string | null;
  success: boolean;
  error?: Error;
};
