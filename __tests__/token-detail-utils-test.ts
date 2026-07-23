import {
  formatTimestamp,
  getEditableTokenFields,
  getParamValue,
  getRolloutFailureDetails,
  getRolloutStateLabel,
  prettifyRefreshError,
} from "@/components/token-detail/token-detail-utils";
import {
  PushTokenRefreshErrorType,
  PushTokenRolloutState,
  type PushToken,
} from "@/types/token";

const messages = {
  defaultMessage: "Refresh failed",
  networkMessage: "Check your connection",
};

const createToken = (overrides: Partial<PushToken> = {}): PushToken => ({
  callbackUrl: "https://mfa.example.com/validate",
  enrollmentCredential: "credential",
  id: "PUSH0001",
  label: "alice@example.com",
  rolloutState: PushTokenRolloutState.Completed,
  sslVerify: true,
  ttl: 10,
  version: 1,
  ...overrides,
});

describe("token detail utilities", () => {
  test("normalizes route parameters and editable fields", () => {
    expect(getParamValue(["first", "second"])).toBe("first");
    expect(getParamValue("value")).toBe("value");
    expect(getParamValue(undefined)).toBeUndefined();
    expect(getEditableTokenFields(createToken({ label: "Alice" }))).toEqual({
      label: "Alice",
    });
  });

  test("formats valid timestamps and omits missing timestamps", () => {
    expect(formatTimestamp(undefined)).toBeNull();
    expect(formatTimestamp(0)).toBeNull();
    expect(formatTimestamp(Date.UTC(2026, 0, 2))).toEqual(expect.any(String));
  });

  test.each([
    PushTokenRolloutState.RSAKeyGenerationFailed,
    PushTokenRolloutState.SendRSAPublicKeyFailed,
    PushTokenRolloutState.ParsingResponseFailed,
    PushTokenRolloutState.Pending,
  ])("provides rollout failure copy for state %s", (state) => {
    const details = getRolloutFailureDetails(state);

    expect(details.title).toEqual(expect.objectContaining({ message: expect.any(String) }));
    expect(details.description).toEqual(
      expect.objectContaining({ message: expect.any(String) }),
    );
  });

  test("labels every rollout state", () => {
    for (const state of [
      PushTokenRolloutState.Pending,
      PushTokenRolloutState.RSAKeyGeneration,
      PushTokenRolloutState.RSAKeyGenerationFailed,
      PushTokenRolloutState.SendRSAPublicKey,
      PushTokenRolloutState.SendRSAPublicKeyFailed,
      PushTokenRolloutState.ParsingResponse,
      PushTokenRolloutState.ParsingResponseFailed,
      PushTokenRolloutState.Completed,
    ]) {
      expect(getRolloutStateLabel(state)).toEqual(
        expect.objectContaining({ message: expect.any(String) }),
      );
    }
  });

  test("uses dedicated network and fallback refresh messages", () => {
    expect(
      prettifyRefreshError(
        "ignored",
        PushTokenRefreshErrorType.Network,
        messages,
      ),
    ).toEqual({ message: messages.networkMessage });
    expect(prettifyRefreshError(undefined, undefined, messages)).toEqual({
      message: messages.defaultMessage,
    });
  });

  test.each([
    [
      '{"result":{"error":{"message":"Nested failure"}}}',
      "Nested failure",
    ],
    ['{"detail":"Enrollment expired"}', "Enrollment expired"],
    ["plain server response", "plain server response"],
  ])("extracts useful server errors from %s", (body, serverMessage) => {
    expect(
      prettifyRefreshError(`Server returned 500: ${body}`, undefined, messages),
    ).toEqual({
      message: messages.defaultMessage,
      serverMessage,
    });
  });

  test("does not expose empty server response bodies", () => {
    expect(
      prettifyRefreshError("Server returned 500:   ", undefined, messages),
    ).toEqual({ message: messages.defaultMessage });
  });
});
