import {
  pollAllChallenges,
  pollChallengesForToken,
} from "@/services/challenge-polling";
import {
  ChallengePollingNetworkError,
  ChallengePollingServerError,
} from "@/errors/challenge-polling";
import { signMessage, verifyMessage } from "@/utils/rsa";
import { PushTokenRolloutState as State } from "@/types/token";
import { token, request, response } from "./fixtures";

jest.mock("@/utils/rsa", () => ({
  signMessage: jest.fn(),
  verifyMessage: jest.fn(),
}));
const fetchMock = jest.fn<
  Promise<Response>,
  [RequestInfo | URL, RequestInit?]
>();
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date("2026-09-30T10:00:00Z"));
  globalThis.fetch = fetchMock;
  fetchMock
    .mockReset()
    .mockResolvedValue(response(200, { result: { value: [request] } }));
  jest.mocked(signMessage).mockReset().mockResolvedValue("Zg==");
  jest.mocked(verifyMessage).mockReset().mockResolvedValue(true);
});
afterEach(() => jest.useRealTimers());

test("signs timestamp, preserves existing query parameters and parses challenges", async () => {
  const result = await pollChallengesForToken({
    ...token,
    callbackUrl: `${token.callbackUrl}?existing=value`,
    serverPublicKey: "server-key",
  });
  expect(result).toMatchObject({
    success: true,
    challenges: [
      { nonce: "nonce", id: `poll-nonce-${Date.now()}`, sentAt: Date.now() },
    ],
  });
  expect(signMessage).toHaveBeenCalledWith(
    "serial|2026-09-30T10:00:00.000Z",
    "serial",
    "SHA256",
  );
  const url = new URL(String(fetchMock.mock.calls[0][0]));
  expect(Object.fromEntries(url.searchParams)).toEqual({
    existing: "value",
    serial: "serial",
    timestamp: "2026-09-30T10:00:00.000Z",
    signature: "MY======",
  });
  expect(fetchMock.mock.calls[0][1]).toEqual({
    method: "GET",
    headers: { Accept: "application/json" },
  });
  expect(verifyMessage).toHaveBeenCalledWith(
    "nonce|https://example.org/push|serial|Sign in?|Login|1",
    "Zg==",
    "server-key",
  );
});
test("supports tokens without server public key", async () => {
  expect((await pollChallengesForToken(token)).challenges).toHaveLength(1);
  expect(verifyMessage).not.toHaveBeenCalled();
});
test.each([204, 404])("treats %s as no challenges", async (status) => {
  fetchMock.mockResolvedValue(response(status));
  await expect(pollChallengesForToken(token)).resolves.toEqual({
    success: true,
    challenges: [],
  });
});
test.each([{}, null, { result: {} }])(
  "handles empty payload %p",
  async (body) => {
    fetchMock.mockResolvedValue(response(200, body));
    expect((await pollChallengesForToken(token)).challenges).toEqual([]);
  },
);
test("returns server error with status and body", async () => {
  fetchMock.mockResolvedValue(response(503, "unavailable"));
  expect((await pollChallengesForToken(token)).error).toEqual(
    new ChallengePollingServerError(503, '"unavailable"'),
  );
});
test.each([new Error("offline"), "offline"])(
  "wraps network failure %p",
  async (error) => {
    fetchMock.mockRejectedValue(error);
    expect((await pollChallengesForToken(token)).error).toEqual(
      new ChallengePollingNetworkError(new Error("offline")),
    );
  },
);
test.each([new Error("signing"), "signing"])(
  "handles signing failures %p",
  async (error) => {
    jest.mocked(signMessage).mockRejectedValue(error);
    expect((await pollChallengesForToken(token)).error).toEqual(
      new Error("signing"),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  },
);
test("filters invalid signatures while keeping valid challenges", async () => {
  fetchMock.mockResolvedValue(
    response(200, {
      result: {
        value: [
          request,
          { ...request, nonce: "second" },
          { ...request, nonce: "third" },
        ],
      },
    }),
  );
  jest
    .mocked(verifyMessage)
    .mockResolvedValueOnce(false)
    .mockRejectedValueOnce(new Error("bad key"))
    .mockResolvedValueOnce(true);
  expect(
    (
      await pollChallengesForToken({ ...token, serverPublicKey: "key" })
    ).challenges.map((challenge) => challenge.nonce),
  ).toEqual(["third"]);
});
test("returns empty aggregate when no completed tokens exist", async () => {
  await expect(pollAllChallenges([token])).resolves.toEqual({
    success: true,
    challenges: [],
    tokenResults: [],
  });
  expect(fetchMock).not.toHaveBeenCalled();
});
test("aggregates completed tokens and reports partial failures", async () => {
  fetchMock
    .mockResolvedValueOnce(response(200, { result: { value: [request] } }))
    .mockRejectedValueOnce(new Error("offline"));
  const result = await pollAllChallenges([
    token,
    { ...token, id: "first", rolloutState: State.Completed },
    { ...token, id: "second", rolloutState: State.Completed },
  ]);
  expect(result.success).toBe(false);
  expect(result.challenges).toHaveLength(1);
  expect(result.tokenResults).toMatchObject([
    { tokenId: "first", success: true },
    { tokenId: "second", success: false },
  ]);
  expect(result.error?.message).toBe("1 token(s) failed to poll");
});
test("successful aggregate has no error", async () => {
  expect(
    await pollAllChallenges([{ ...token, rolloutState: State.Completed }]),
  ).toMatchObject({ success: true, error: undefined });
});

test.each(["https://example.org/token.png", null, ""])(
  "refreshes token image without pending challenges: %p",
  async (image) => {
    fetchMock.mockResolvedValue(
      response(200, { result: { value: [] }, detail: { image } }),
    );
    const imageUrl = image || null;
    await expect(pollChallengesForToken(token)).resolves.toEqual({
      success: true,
      challenges: [],
      imageUrl,
    });
    const result = await pollAllChallenges([
      { ...token, rolloutState: State.Completed },
    ]);
    expect(result.tokenResults).toMatchObject([
      { tokenId: token.id, success: true, imageUrl },
    ]);
  },
);

test.each([undefined, 123, {}, "invalid", "file:///tmp/image.png"])(
  "preserves existing image for missing or invalid metadata: %p",
  async (image) => {
    fetchMock.mockResolvedValue(
      response(200, { result: { value: [request] }, detail: { image } }),
    );
    const result = await pollChallengesForToken(token);
    expect(result.success).toBe(true);
    expect(result.challenges).toHaveLength(1);
    expect(result).not.toHaveProperty("imageUrl");
  },
);
