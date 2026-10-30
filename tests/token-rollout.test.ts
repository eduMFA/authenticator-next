import {
  deleteTokenPrivateKey,
  isTokenRollingOut,
  performTokenRollout,
  startPendingRollouts,
} from "@/services/token-rollout";
import { useNotificationStore } from "@/stores/notification";
import { generateRsaKeyPair, deleteRsaKeyPair } from "@/utils/rsa";
import { PushTokenRolloutState as State } from "@/types/token";
import type { RolloutStateUpdater } from "@/types/token-rollout";
import { deferred, token, response } from "./fixtures";
import { i18n } from "@lingui/core";
import { messages as englishMessages } from "@/locales/en/messages";
import { messages as germanMessages } from "@/locales/de/messages";

jest.mock("@/stores/notification", () => ({
  useNotificationStore: { getState: jest.fn() },
}));
jest.mock("@/utils/rsa", () => ({
  generateRsaKeyPair: jest.fn(),
  deleteRsaKeyPair: jest.fn(),
}));
const fetchMock = jest.fn<
  Promise<Response>,
  [RequestInfo | URL, RequestInit?]
>();
const getFcmToken = jest.fn<Promise<string | null>, []>();
const updateState = jest.fn<
  ReturnType<RolloutStateUpdater>,
  Parameters<RolloutStateUpdater>
>();
beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: englishMessages });
  globalThis.fetch = fetchMock;
  fetchMock
    .mockReset()
    .mockResolvedValue(
      response(200, { detail: { public_key: "server\nkey" } }),
    );
  getFcmToken.mockReset().mockResolvedValue("fcm");
  jest
    .spyOn(useNotificationStore, "getState")
    .mockReturnValue({ getFcmToken } as unknown as ReturnType<
      typeof useNotificationStore.getState
    >);
  jest.mocked(generateRsaKeyPair).mockReset().mockResolvedValue({
    publicKey: "-----BEGIN PUBLIC KEY-----\nabc\n-----END PUBLIC KEY-----",
  });
});

test("enrolls token with ordered state updates and stripped public key", async () => {
  await expect(performTokenRollout(token, updateState)).resolves.toEqual({
    success: true,
    serverPublicKey: "serverkey",
  });
  expect(generateRsaKeyPair).toHaveBeenCalledWith("serial", 4096);
  expect(updateState).toHaveBeenLastCalledWith(token.id, {
    rolloutState: State.Completed,
    serverPublicKey: "serverkey",
    registeredFcmToken: "fcm",
  });
  expect(
    updateState.mock.calls.flatMap(([, fields]) =>
      fields.rolloutState === undefined ? [] : [fields.rolloutState],
    ),
  ).toEqual([
    State.RSAKeyGeneration,
    State.SendRSAPublicKey,
    State.ParsingResponse,
    State.Completed,
  ]);
  expect(fetchMock).toHaveBeenCalledWith(token.callbackUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      enrollment_credential: "credential",
      serial: "serial",
      fbtoken: "fcm",
      pubkey: "abc",
    }),
  });
  expect(isTokenRollingOut(token.id)).toBe(false);
});
test.each([
  State.Completed,
  State.RSAKeyGenerationFailed,
  State.SendRSAPublicKeyFailed,
  State.ParsingResponseFailed,
])("skips processed state %s", async (rolloutState) => {
  expect(
    (await performTokenRollout({ ...token, rolloutState }, updateState)).error
      ?.message,
  ).toBe("Token already processed");
  expect(getFcmToken).not.toHaveBeenCalled();
});
test("prevents concurrent enrollment and releases lock afterwards", async () => {
  let resolveFcm: (value: string) => void = () => {
    throw new Error("not initialized");
  };
  getFcmToken.mockReturnValue(
    new Promise<string>((resolve) => {
      resolveFcm = resolve;
    }),
  );
  const pending = performTokenRollout(token, updateState);
  expect(isTokenRollingOut(token.id)).toBe(true);
  expect((await performTokenRollout(token, updateState)).error?.message).toBe(
    "Already rolling out",
  );
  startPendingRollouts(() => [token], updateState);
  expect(getFcmToken).toHaveBeenCalledTimes(1);
  resolveFcm("fcm");
  await pending;
  expect(isTokenRollingOut(token.id)).toBe(false);
});
test("handles missing FCM token before key generation", async () => {
  getFcmToken.mockResolvedValue(null);
  expect(await performTokenRollout(token, updateState)).toMatchObject({
    success: false,
    error: new Error("Failed to retrieve FCM token"),
    failedState: undefined,
  });
  expect(generateRsaKeyPair).not.toHaveBeenCalled();
  expect(isTokenRollingOut(token.id)).toBe(false);
});
test("rejects expired enrollment without generating keys or contacting the server", async () => {
  expect(
    await performTokenRollout(
      { ...token, enrollmentStartedAt: Date.now() - token.ttl * 60_000 },
      updateState,
    ),
  ).toMatchObject({
    success: false,
    failedState: State.SendRSAPublicKeyFailed,
  });
  expect(generateRsaKeyPair).not.toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalled();
});
test.each([
  {
    locale: "en",
    messages: englishMessages,
    expected: "Enrollment expired. Scan a new enrollment QR code.",
  },
  {
    locale: "de",
    messages: germanMessages,
    expected:
      "Die Registrierung ist abgelaufen. Scanne einen neuen Registrierungs-QR-Code.",
  },
])(
  "reports enrollment expiry in $locale",
  async ({ locale, messages, expected }) => {
    i18n.loadAndActivate({ locale, messages });
    const result = await performTokenRollout(
      { ...token, enrollmentStartedAt: Date.now() - token.ttl * 60_000 },
      updateState,
    );
    expect(result.error?.message).toBe(expected);
  },
);
test("checks expiry again after slow key generation", async () => {
  const now = Date.now();
  jest.mocked(generateRsaKeyPair).mockImplementation(async () => {
    jest.spyOn(Date, "now").mockReturnValue(now + token.ttl * 60_000);
    return { publicKey: "key" };
  });
  expect(
    await performTokenRollout(
      { ...token, enrollmentStartedAt: now },
      updateState,
    ),
  ).toMatchObject({ success: false });
  expect(fetchMock).not.toHaveBeenCalled();
});
test.each([new Error("key failure"), "key failure"])(
  "maps key generation failure %p",
  async (error) => {
    jest.mocked(generateRsaKeyPair).mockRejectedValue(error);
    expect(await performTokenRollout(token, updateState)).toMatchObject({
      success: false,
      failedState: State.RSAKeyGenerationFailed,
      error: new Error("key failure"),
    });
    expect(updateState).toHaveBeenLastCalledWith(token.id, {
      rolloutState: State.RSAKeyGenerationFailed,
    });
    expect(isTokenRollingOut(token.id)).toBe(false);
  },
);
test("maps network failure to registration failure", async () => {
  fetchMock.mockRejectedValue(new Error("offline"));
  expect(await performTokenRollout(token, updateState)).toMatchObject({
    success: false,
    failedState: State.SendRSAPublicKeyFailed,
  });
});
test("handles server rejection", async () => {
  fetchMock.mockResolvedValue(response(400));
  expect(await performTokenRollout(token, updateState)).toEqual({
    success: false,
    failedState: State.SendRSAPublicKeyFailed,
  });
});
test("maps malformed server response to parsing failure", async () => {
  fetchMock.mockResolvedValue(response());
  expect(await performTokenRollout(token, updateState)).toMatchObject({
    success: false,
    failedState: State.ParsingResponseFailed,
  });
});
test("starts only pending rollouts", async () => {
  const completed = deferred<void>();
  updateState.mockImplementationOnce(() => {});
  updateState.mockImplementation((_, fields) => {
    if (fields.rolloutState === State.Completed) completed.resolve();
  });
  startPendingRollouts(
    () => [
      token,
      { ...token, id: "done", rolloutState: State.Completed },
      { ...token, id: "failed", rolloutState: State.ParsingResponseFailed },
    ],
    updateState,
  );
  await completed.promise;
  updateState.mockReset();
  expect(generateRsaKeyPair).toHaveBeenCalledTimes(1);
  expect(isTokenRollingOut(token.id)).toBe(false);
});
test("deletes private keys and propagates deletion errors", async () => {
  jest.mocked(deleteRsaKeyPair).mockResolvedValue(true);
  await expect(deleteTokenPrivateKey("serial")).resolves.toBeUndefined();
  expect(deleteRsaKeyPair).toHaveBeenCalledWith("serial");
  jest.mocked(deleteRsaKeyPair).mockRejectedValue(new Error("locked"));
  await expect(deleteTokenPrivateKey("serial")).rejects.toThrow("locked");
});
