jest.mock("expo-haptics", () => ({
  __esModule: true,
  NotificationFeedbackType: {
    Success: "success",
    Warning: "warning",
  },
  notificationAsync: jest.fn(),
}));

jest.mock("@/utils/rsa", () => ({
  __esModule: true,
  signMessage: jest.fn(),
}));

import * as Haptics from "expo-haptics";

import {
  findTokenForPushRequest,
  handlePushAuthRequest,
} from "@/services/pushAuthService";
import {
  PushRequest,
  PushRequestStatus,
  PushToken,
  PushTokenRolloutState,
} from "@/types";
import { base64ToBase32 } from "@/utils/crypto";
import { signMessage } from "@/utils/rsa";

const mockNotificationAsync = Haptics.notificationAsync as jest.Mock;
const mockSignMessage = signMessage as jest.Mock;

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

const createRequest = (
  overrides: Partial<PushRequest> = {},
): PushRequest => ({
  id: "request-1",
  nonce: "nonce-1",
  question: "Allow login?",
  sentAt: 1_000,
  serial: "PUSH0001",
  signature: "signature",
  sslverify: "1",
  status: PushRequestStatus.Pending,
  title: "Login",
  url: "https://mfa.example.com/validate",
  ...overrides,
});

describe("push auth service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    globalThis.fetch = jest.fn().mockResolvedValue({
      status: 200,
    }) as jest.Mock;
    mockSignMessage.mockResolvedValue("c2ln");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("signs and sends accepted push requests", async () => {
    const token = createToken();
    const request = createRequest();

    await expect(handlePushAuthRequest(request, token)).resolves.toEqual({
      success: true,
    });

    expect(mockSignMessage).toHaveBeenCalledWith(
      "nonce-1|PUSH0001",
      "PUSH0001",
      "SHA256",
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(token.callbackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nonce: request.nonce,
        serial: token.id,
        signature: base64ToBase32("c2ln"),
        decline: 0,
      }),
    });
    expect(mockNotificationAsync).toHaveBeenCalledWith("success");
  });

  test("includes decline marker for declined requests", async () => {
    const request = createRequest({ status: PushRequestStatus.Declined });

    await handlePushAuthRequest(request, createToken());

    expect(mockSignMessage).toHaveBeenCalledWith(
      "nonce-1|PUSH0001|decline",
      "PUSH0001",
      "SHA256",
    );
    expect(
      JSON.parse((globalThis.fetch as jest.Mock).mock.calls[0][1].body),
    ).toMatchObject({
      decline: 1,
    });
    expect(mockNotificationAsync).toHaveBeenCalledWith("warning");
  });

  test("returns server errors without haptic success feedback", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      status: 500,
      text: jest.fn().mockResolvedValue("server error"),
    });

    await expect(
      handlePushAuthRequest(createRequest(), createToken()),
    ).resolves.toMatchObject({
      success: false,
      error: expect.any(Error),
    });
    expect(mockNotificationAsync).not.toHaveBeenCalled();
  });

  test("returns thrown signing errors", async () => {
    mockSignMessage.mockRejectedValueOnce(new Error("sign failed"));

    await expect(
      handlePushAuthRequest(createRequest(), createToken()),
    ).resolves.toMatchObject({
      success: false,
      error: expect.any(Error),
    });
  });

  test("finds tokens by push request serial", () => {
    const matchingToken = createToken();
    const otherToken = createToken({ id: "PUSH0002" });

    expect(
      findTokenForPushRequest(createRequest(), [otherToken, matchingToken]),
    ).toBe(matchingToken);
    expect(
      findTokenForPushRequest(createRequest({ serial: "missing" }), [
        matchingToken,
      ]),
    ).toBeUndefined();
  });
});
