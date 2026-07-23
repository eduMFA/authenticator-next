import { PushTokenRolloutState } from "@/types/token";

describe("PushTokenRolloutState helpers", () => {
  test("identifies failed rollout states", () => {
    expect(
      PushTokenRolloutState.isFailed(
        PushTokenRolloutState.RSAKeyGenerationFailed,
      ),
    ).toBe(true);
    expect(
      PushTokenRolloutState.isFailed(
        PushTokenRolloutState.SendRSAPublicKeyFailed,
      ),
    ).toBe(true);
    expect(
      PushTokenRolloutState.isFailed(
        PushTokenRolloutState.ParsingResponseFailed,
      ),
    ).toBe(true);
    expect(PushTokenRolloutState.isFailed(PushTokenRolloutState.Pending)).toBe(
      false,
    );
  });

  test("identifies finished and in-progress states", () => {
    expect(
      PushTokenRolloutState.isFinished(PushTokenRolloutState.Completed),
    ).toBe(true);
    expect(
      PushTokenRolloutState.isFinished(
        PushTokenRolloutState.SendRSAPublicKeyFailed,
      ),
    ).toBe(true);
    expect(
      PushTokenRolloutState.isFinished(PushTokenRolloutState.SendRSAPublicKey),
    ).toBe(false);

    expect(
      PushTokenRolloutState.needsRollout(PushTokenRolloutState.Pending),
    ).toBe(true);
    expect(
      PushTokenRolloutState.needsRollout(PushTokenRolloutState.Completed),
    ).toBe(false);
    expect(
      PushTokenRolloutState.needsRollout(
        PushTokenRolloutState.ParsingResponseFailed,
      ),
    ).toBe(false);
  });

  test("maps rollout states to progress percentages", () => {
    expect(PushTokenRolloutState.getProgress(PushTokenRolloutState.Pending)).toBe(
      0,
    );
    expect(
      PushTokenRolloutState.getProgress(PushTokenRolloutState.RSAKeyGeneration),
    ).toBe(40);
    expect(
      PushTokenRolloutState.getProgress(PushTokenRolloutState.SendRSAPublicKey),
    ).toBe(70);
    expect(
      PushTokenRolloutState.getProgress(PushTokenRolloutState.ParsingResponse),
    ).toBe(90);
    expect(
      PushTokenRolloutState.getProgress(PushTokenRolloutState.Completed),
    ).toBe(100);
    expect(
      PushTokenRolloutState.getProgress(
        PushTokenRolloutState.SendRSAPublicKeyFailed,
      ),
    ).toBe(100);
  });
});
