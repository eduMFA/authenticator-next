jest.mock("@/utils/rsa", () => ({
  __esModule: true,
  deleteRsaKeyPair: jest.fn(),
  generateRsaKeyPair: jest.fn(),
}));

jest.mock("@/stores/notification", () => ({
  __esModule: true,
  useNotificationStore: {
    getState: jest.fn(),
  },
}));

import { useNotificationStore } from "@/stores/notification";
import { deleteRsaKeyPair, generateRsaKeyPair } from "@/utils/rsa";
import {
  deleteTokenPrivateKey,
  isTokenRollingOut,
  performTokenRollout,
  startPendingRollouts,
} from "@/services/token-rollout";
import type { PushToken } from "@/types/token";
import { PushTokenRolloutState } from "@/types/token";

const mockDeleteRsaKeyPair = deleteRsaKeyPair as jest.Mock;
const mockGenerateRsaKeyPair = generateRsaKeyPair as jest.Mock;
const mockGetFcmToken = jest.fn();
const mockNotificationStoreGetState =
  useNotificationStore.getState as jest.Mock;

const clientPublicKey =
  "-----BEGIN PUBLIC KEY-----\nclient-public-key\n-----END PUBLIC KEY-----";

const createToken = (overrides: Partial<PushToken> = {}): PushToken => ({
  callbackUrl: "https://mfa.example.com/enroll",
  enrollmentCredential: "credential",
  id: "PUSH0001",
  label: "alice@example.com",
  rolloutState: PushTokenRolloutState.Pending,
  sslVerify: true,
  ttl: 10,
  version: 1,
  ...overrides,
});

const createSuccessfulResponse = () => ({
  ok: true,
  json: jest.fn().mockResolvedValue({
    detail: {
      public_key:
        "-----BEGIN PUBLIC KEY-----\nserver-public-key\n-----END PUBLIC KEY-----",
    },
  }),
});

describe("token rollout service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    mockNotificationStoreGetState.mockReturnValue({
      getFcmToken: mockGetFcmToken,
    });
    mockGenerateRsaKeyPair.mockResolvedValue({ publicKey: clientPublicKey });
    mockGetFcmToken.mockResolvedValue("fcm-token");
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(createSuccessfulResponse()) as jest.Mock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("performs a successful token rollout", async () => {
    const token = createToken();
    const updateState = jest.fn();

    await expect(performTokenRollout(token, updateState)).resolves.toEqual({
      success: true,
      serverPublicKey:
        "-----BEGIN PUBLIC KEY-----server-public-key-----END PUBLIC KEY-----",
    });

    expect(mockGenerateRsaKeyPair).toHaveBeenCalledWith(token.id, 4096);
    expect(globalThis.fetch).toHaveBeenCalledWith(token.callbackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enrollment_credential: token.enrollmentCredential,
        serial: token.id,
        fbtoken: "fcm-token",
        pubkey: "client-public-key",
      }),
    });
    expect(updateState).toHaveBeenCalledWith(token.id, {
      rolloutState: PushTokenRolloutState.RSAKeyGeneration,
    });
    expect(updateState).toHaveBeenCalledWith(token.id, {
      rolloutState: PushTokenRolloutState.SendRSAPublicKey,
      publicKey: clientPublicKey,
    });
    expect(updateState).toHaveBeenCalledWith(token.id, {
      rolloutState: PushTokenRolloutState.ParsingResponse,
    });
    expect(updateState).toHaveBeenCalledWith(token.id, {
      rolloutState: PushTokenRolloutState.Completed,
      serverPublicKey:
        "-----BEGIN PUBLIC KEY-----server-public-key-----END PUBLIC KEY-----",
    });
  });

  test("rejects duplicate concurrent rollouts", async () => {
    let resolveKeyGeneration:
      | ((value: { publicKey: string }) => void)
      | undefined;
    mockGenerateRsaKeyPair.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveKeyGeneration = resolve;
        }),
    );

    const token = createToken({ id: "PUSH-CONCURRENT" });
    const firstRollout = performTokenRollout(token, jest.fn());

    expect(isTokenRollingOut(token.id)).toBe(true);
    await expect(performTokenRollout(token, jest.fn())).resolves.toMatchObject({
      success: false,
      error: expect.any(Error),
    });

    resolveKeyGeneration?.({ publicKey: clientPublicKey });
    await firstRollout;
    expect(isTokenRollingOut(token.id)).toBe(false);
  });

  test("does not roll out completed or failed tokens", async () => {
    await expect(
      performTokenRollout(
        createToken({ rolloutState: PushTokenRolloutState.Completed }),
        jest.fn(),
      ),
    ).resolves.toMatchObject({
      success: false,
      error: expect.any(Error),
    });

    await expect(
      performTokenRollout(
        createToken({
          id: "PUSH-FAILED",
          rolloutState: PushTokenRolloutState.RSAKeyGenerationFailed,
        }),
        jest.fn(),
      ),
    ).resolves.toMatchObject({
      success: false,
      error: expect.any(Error),
    });

    expect(mockGenerateRsaKeyPair).not.toHaveBeenCalled();
  });

  test("marks server enrollment failures", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue("server error"),
    });
    const updateState = jest.fn();

    await expect(
      performTokenRollout(createToken(), updateState),
    ).resolves.toMatchObject({
      success: false,
      failedState: PushTokenRolloutState.SendRSAPublicKeyFailed,
    });

    expect(updateState).toHaveBeenCalledWith("PUSH0001", {
      rolloutState: PushTokenRolloutState.SendRSAPublicKeyFailed,
    });
  });

  test("reports missing FCM tokens before rollout starts", async () => {
    mockGetFcmToken.mockResolvedValueOnce(null);
    const updateState = jest.fn();

    await expect(
      performTokenRollout(createToken(), updateState),
    ).resolves.toMatchObject({
      success: false,
      error: expect.any(Error),
      failedState: undefined,
    });

    expect(updateState).not.toHaveBeenCalled();
  });

  test("starts rollout for only pending tokens", async () => {
    const updateState = jest.fn();
    startPendingRollouts(
      () => [
        createToken({ id: "PUSH-PENDING" }),
        createToken({
          id: "PUSH-COMPLETE",
          rolloutState: PushTokenRolloutState.Completed,
        }),
        createToken({
          id: "PUSH-FAILED",
          rolloutState: PushTokenRolloutState.SendRSAPublicKeyFailed,
        }),
      ],
      updateState,
    );

    await Promise.resolve();
    await Promise.resolve();
    expect(mockGenerateRsaKeyPair).toHaveBeenCalledTimes(1);
    expect(mockGenerateRsaKeyPair).toHaveBeenCalledWith("PUSH-PENDING", 4096);
  });

  test("deletes token private keys", async () => {
    mockDeleteRsaKeyPair.mockResolvedValueOnce(true);

    await expect(deleteTokenPrivateKey("PUSH0001")).resolves.toBeUndefined();
    expect(mockDeleteRsaKeyPair).toHaveBeenCalledWith("PUSH0001");

    mockDeleteRsaKeyPair.mockRejectedValueOnce(new Error("delete failed"));
    await expect(deleteTokenPrivateKey("PUSH0001")).rejects.toThrow(
      "delete failed",
    );
  });
});
