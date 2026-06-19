export class ChallengePollingNetworkError extends Error {
  constructor(cause: Error) {
    super(cause.message, { cause });
    this.name = "ChallengePollingNetworkError";
  }
}

export class ChallengePollingServerError extends Error {
  constructor(
    public readonly status: number,
    public readonly responseBody: string,
  ) {
    super(`Server returned ${status}: ${responseBody}`);
    this.name = "ChallengePollingServerError";
  }
}
