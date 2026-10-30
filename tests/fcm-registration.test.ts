import { syncFcmRegistration } from "@/services/fcm-registration";
import { signMessage } from "@/utils/rsa";
import { PushTokenRolloutState as State, type PushToken } from "@/types/token";
import type { RolloutStateUpdater } from "@/types/token-rollout";
import { token, response, deferred } from "./fixtures";

jest.mock("@/utils/rsa", () => ({ signMessage: jest.fn() }));

const fetchMock = jest.fn<
  Promise<Response>,
  [RequestInfo | URL, RequestInit?]
>();
let tokens: PushToken[];
const getTokens = () => tokens;
const updateState: RolloutStateUpdater = (id, fields) => {
  tokens = tokens.map((item) =>
    item.id === id ? { ...item, ...fields } : item,
  );
};

beforeEach(() => {
  tokens = [
    { ...token, rolloutState: State.Completed, registeredFcmToken: "old" },
  ];
  globalThis.fetch = fetchMock;
  fetchMock
    .mockReset()
    .mockResolvedValue(
      response(200, { result: { status: true, value: true } }),
    );
  jest.mocked(signMessage).mockResolvedValue("Zg==");
});

test("signs the backend token update protocol and persists only an acknowledged registration", async () => {
  await syncFcmRegistration(getTokens, "new", updateState);
  const body: {
    serial: string;
    new_fb_token: string;
    timestamp: string;
    signature: string;
  } = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
  expect(body).toMatchObject({
    serial: token.id,
    new_fb_token: "new",
    signature: "MY======",
  });
  expect(signMessage).toHaveBeenCalledWith(
    `new|serial|${body.timestamp}`,
    "serial",
    "SHA256",
  );
  expect(tokens[0].registeredFcmToken).toBe("new");
  await syncFcmRegistration(getTokens, "new", updateState);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("retries rejected updates and keeps the previous registration until success", async () => {
  fetchMock.mockResolvedValueOnce(
    response(200, { result: { status: true, value: false } }),
  );
  await syncFcmRegistration(getTokens, "new", updateState);
  expect(tokens[0].registeredFcmToken).toBe("old");
  await syncFcmRegistration(getTokens, "new", updateState);
  expect(tokens[0].registeredFcmToken).toBe("new");
});

test("does not update incomplete enrollment or erase registration when FCM is unavailable", async () => {
  await syncFcmRegistration(getTokens, null, updateState);
  tokens[0].rolloutState = State.Pending;
  await syncFcmRegistration(getTokens, "new", updateState);
  expect(fetchMock).not.toHaveBeenCalled();
});

test("cancels a queued registration when its FCM token is no longer current", async () => {
  const pending = deferred<string>();
  const signing = deferred<void>();
  jest.mocked(signMessage).mockImplementationOnce(() => {
    signing.resolve();
    return pending.promise;
  });
  let enabled = true;
  const update = syncFcmRegistration(
    getTokens,
    "new",
    updateState,
    () => enabled,
  );
  await signing.promise;
  enabled = false;
  pending.resolve("Zg==");
  await update;
  expect(fetchMock).not.toHaveBeenCalled();
  expect(tokens[0].registeredFcmToken).toBe("old");
});

test("serializes token changes so a slow older update cannot overwrite the newest token", async () => {
  const pending = deferred<Response>();
  const started = deferred<void>();
  fetchMock.mockImplementationOnce(() => {
    started.resolve();
    return pending.promise;
  });
  const first = syncFcmRegistration(getTokens, "first", updateState);
  await started.promise;
  const second = syncFcmRegistration(getTokens, "second", updateState);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  pending.resolve(response(200, { result: { status: true, value: true } }));
  await Promise.all([first, second]);
  expect(tokens[0].registeredFcmToken).toBe("second");
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
