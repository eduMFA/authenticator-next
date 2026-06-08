export const DEFAULT_TOKEN_TTL = 10;

export const TOKEN_ROLLOUT_PROGRESS = {
  pending: 0,
  rsaKeyGeneration: 40,
  sendRsaPublicKey: 70,
  parsingResponse: 90,
  completed: 100,
} as const;
