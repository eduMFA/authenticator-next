import {
  canUpgradeEduPushToken,
  upgradeEligibleEduPushTokens,
  upgradeEduPushToken,
} from "@/services/edupush-upgrade";
import { useTokenStore } from "@/stores/token";
import { i18n } from "@lingui/core";
import { PushTokenRolloutState } from "@/types/token";
import { authenticateAsync } from "expo-local-authentication";
import { fetch } from "expo/fetch";
import { AppState } from "react-native";
import { signMessage } from "@/utils/rsa";
import { deferred, response, token } from "./fixtures";

jest.mock("expo/fetch", () => ({ fetch: jest.fn() }));
jest.mock("expo-local-authentication", () => ({
  authenticateAsync: jest.fn(),
}));
jest.mock("@/utils/rsa", () => ({ signMessage: jest.fn() }));
jest.mock("@/services/token-rollout", () => ({
  startPendingRollouts: jest.fn(),
}));

const enrolled = {
  ...token,
  callbackUrl: "https://example.org/ttype/edupush",
  rolloutState: PushTokenRolloutState.Completed,
  publicKey: "device-key",
  serverPublicKey: "server-key",
  registeredFcmToken: "legacy-fcm",
};
const committed = { push_version: 2 };
const offer = (
  require_device_auth: boolean,
  expires_at = Date.now() / 1000 + 300,
) => ({
  upgrade: {
    target_version: 2,
    nonce: "upgrade-nonce",
    expires_at,
    require_device_auth,
  },
});
function accepted(detail: object) {
  return response(200, {
    result: { status: true, value: true },
    detail,
  }) as unknown as Awaited<ReturnType<typeof fetch>>;
}
const fetchMock = jest.mocked(fetch);
const getToken = () => useTokenStore.getState().tokens[0];

beforeEach(async () => {
  jest.useFakeTimers();
  AppState.currentState = "active";
  i18n.loadAndActivate({ locale: "en", messages: {} });
  await useTokenStore.persist.rehydrate();
  useTokenStore.setState({ tokens: [enrolled] });
  fetchMock.mockReset();
  jest.mocked(signMessage).mockResolvedValue("Zg==");
  jest.mocked(authenticateAsync).mockResolvedValue({ success: true });
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

test("upgrades over HTTPS without polling and retains the enrolled keys", async () => {
  fetchMock
    .mockResolvedValueOnce(accepted(offer(true)))
    .mockImplementationOnce(async () => {
      expect(getToken()).toMatchObject({ version: 1, requireDeviceAuth: true });
      return accepted(committed);
    });
  await upgradeEduPushToken(enrolled);
  const begin = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
  expect(begin).toEqual({
    operation: "begin_upgrade",
    serial: token.id,
    target_version: 2,
    timestamp: expect.any(String),
    signature: "MY======",
  });
  expect(fetchMock.mock.calls[0]).toEqual([
    enrolled.callbackUrl,
    expect.objectContaining({ method: "POST", redirect: "error" }),
  ]);
  expect(signMessage).toHaveBeenNthCalledWith(
    1,
    JSON.stringify(["begin_upgrade", token.id, 2, begin.timestamp]),
    token.id,
    "SHA256",
  );
  expect(authenticateAsync).toHaveBeenCalledTimes(1);
  expect(signMessage).toHaveBeenNthCalledWith(
    2,
    JSON.stringify(["confirm_upgrade", token.id, 2, "upgrade-nonce", true]),
    token.id,
    "SHA256",
  );
  expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
    operation: "confirm_upgrade",
    serial: token.id,
    target_version: 2,
    nonce: "upgrade-nonce",
    require_device_auth: true,
    signature: "MY======",
  });
  expect(getToken()).toMatchObject({
    id: token.id,
    version: 2,
    publicKey: "device-key",
    serverPublicKey: "server-key",
    requireDeviceAuth: true,
    registeredFcmToken: "legacy-fcm",
  });
});

test("recovers a lost confirmation response using the device auth policy saved before confirmation", async () => {
  fetchMock
    .mockResolvedValueOnce(accepted(offer(false)))
    .mockRejectedValueOnce(new Error("Connection lost"))
    .mockResolvedValueOnce(accepted(committed));
  await expect(upgradeEduPushToken(enrolled)).rejects.toThrow(
    "Connection lost",
  );
  expect(getToken()).toMatchObject({ version: 1, requireDeviceAuth: false });
  await upgradeEduPushToken(getToken());
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(authenticateAsync).not.toHaveBeenCalled();
  expect(getToken()).toMatchObject({ version: 2, requireDeviceAuth: false });
});

test("skips confirmation if required device authentication fails", async () => {
  fetchMock.mockResolvedValueOnce(accepted(offer(true)));
  jest
    .mocked(authenticateAsync)
    .mockResolvedValue({ success: false, error: "user_cancel" });
  await expect(upgradeEduPushToken(enrolled)).rejects.toThrow();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(getToken().version).toBe(1);
});

test("rejects expired offers before confirmation", async () => {
  fetchMock.mockResolvedValueOnce(accepted(offer(false, 1)));
  await expect(upgradeEduPushToken(enrolled)).rejects.toThrow(
    "valid upgrade offer",
  );
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(getToken().version).toBe(1);
});

test("supports advertised aliases and excludes cleartext and legacy endpoints", () => {
  expect(
    canUpgradeEduPushToken({
      ...enrolled,
      callbackUrl: "https://example.org/ttype/push",
    }),
  ).toBe(false);
  expect(
    canUpgradeEduPushToken({
      ...enrolled,
      callbackUrl: "http://example.org/ttype/edupush",
    }),
  ).toBe(false);
  expect(
    canUpgradeEduPushToken({
      ...enrolled,
      availableUpgrade: 2,
      callbackUrl: token.callbackUrl,
    }),
  ).toBe(true);
});

test("automatically upgrades eligible tokens without polling and skips other tokens", async () => {
  const automatic = { ...enrolled, id: "automatic" };
  const legacy = {
    ...enrolled,
    id: "legacy",
    callbackUrl: "https://example.org/ttype/push",
  };
  const completed = { ...enrolled, id: "completed", version: 2 };
  useTokenStore.setState({ tokens: [legacy, automatic, completed] });
  fetchMock
    .mockResolvedValueOnce(accepted(offer(false)))
    .mockResolvedValueOnce(accepted(committed));

  await upgradeEligibleEduPushTokens();

  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(useTokenStore.getState().tokens).toEqual([
    legacy,
    expect.objectContaining({ id: automatic.id, version: 2 }),
    completed,
  ]);
});

test("coalesces automatic runs and backs off failed upgrades", async () => {
  const automatic = { ...enrolled, id: "retry-automatic" };
  useTokenStore.setState({ tokens: [automatic] });
  const request = deferred<Awaited<ReturnType<typeof fetch>>>();
  fetchMock.mockReturnValueOnce(request.promise);
  const first = upgradeEligibleEduPushTokens();
  await upgradeEligibleEduPushTokens();
  request.resolve(
    response(503) as unknown as Awaited<ReturnType<typeof fetch>>,
  );
  await first;
  await upgradeEligibleEduPushTokens();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(getToken().version).toBe(1);

  jest.advanceTimersByTime(5 * 60_000);
  fetchMock.mockResolvedValueOnce(accepted(committed));
  await upgradeEligibleEduPushTokens();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(getToken().version).toBe(2);
});

test("does not start upgrades or show a device authentication prompt in the background", async () => {
  useTokenStore.setState({
    tokens: [{ ...enrolled, id: "background-automatic" }],
  });
  AppState.currentState = "background";
  await upgradeEligibleEduPushTokens();
  expect(fetchMock).not.toHaveBeenCalled();

  AppState.currentState = "active";
  fetchMock.mockImplementationOnce(async () => {
    AppState.currentState = "background";
    return accepted(offer(true));
  });
  await upgradeEligibleEduPushTokens();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(authenticateAsync).not.toHaveBeenCalled();
  expect(getToken().version).toBe(1);
});
