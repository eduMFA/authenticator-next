import {
  findTokenForPushRequest,
  handlePushAuthRequest,
} from "@/services/push-auth";
import { signMessage } from "@/utils/rsa";
import {
  playNotificationSuccessHaptic,
  playNotificationWarningHaptic,
} from "@/utils/haptics";
import { PushRequestStatus } from "@/types/push-request";
import { token, request, response } from "./fixtures";

jest.mock("@/utils/rsa", () => ({ signMessage: jest.fn() }));
jest.mock("@/utils/haptics", () => ({
  playNotificationSuccessHaptic: jest.fn(),
  playNotificationWarningHaptic: jest.fn(),
}));
const fetchMock = jest.fn<
  Promise<Response>,
  [RequestInfo | URL, RequestInit?]
>();
beforeEach(() => {
  globalThis.fetch = fetchMock;
  fetchMock
    .mockReset()
    .mockResolvedValue(
      response(200, { result: { status: true, value: true } }),
    );
  jest.mocked(signMessage).mockReset().mockResolvedValue("Zg==");
});

test.each([PushRequestStatus.Accepted, PushRequestStatus.Declined])(
  "signs and submits %s response",
  async (status) => {
    const declined = status === PushRequestStatus.Declined;
    await expect(
      handlePushAuthRequest({ ...request, status }, token),
    ).resolves.toEqual({ success: true });
    expect(signMessage).toHaveBeenCalledWith(
      `nonce|serial${declined ? "|decline" : ""}`,
      token.id,
      "SHA256",
    );
    expect(fetchMock).toHaveBeenCalledWith(token.callbackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nonce: "nonce",
        serial: "serial",
        signature: "MY======",
        decline: declined ? 1 : 0,
      }),
    });
    expect(
      declined ? playNotificationWarningHaptic : playNotificationSuccessHaptic,
    ).toHaveBeenCalledTimes(1);
    expect(
      declined ? playNotificationSuccessHaptic : playNotificationWarningHaptic,
    ).not.toHaveBeenCalled();
  },
);
test("reports HTTP failure without success feedback", async () => {
  fetchMock.mockResolvedValue(response(500));
  expect(await handlePushAuthRequest(request, token)).toEqual({
    success: false,
    error: new Error("Server returned 500"),
  });
  expect(playNotificationSuccessHaptic).not.toHaveBeenCalled();
});
test.each([new Error("offline"), "offline"])(
  "normalizes network rejection %p",
  async (error) => {
    fetchMock.mockRejectedValue(error);
    expect(await handlePushAuthRequest(request, token)).toEqual({
      success: false,
      error: new Error("offline"),
    });
  },
);
test("does not submit if signing fails", async () => {
  jest.mocked(signMessage).mockRejectedValue(new Error("key unavailable"));
  expect((await handlePushAuthRequest(request, token)).success).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
});
test("matches serial and handles unknown tokens", () => {
  expect(
    findTokenForPushRequest(request, [{ ...token, id: "other" }, token]),
  ).toBe(token);
  expect(findTokenForPushRequest(request, [])).toBeUndefined();
});

test("binds the selected number to the signature and request", async () => {
  const numbered = {
    ...request,
    challenge_type: "number" as const,
    challenge_choices: "17,42,86",
    challenge_response: "42",
  };
  await expect(handlePushAuthRequest(numbered, token)).resolves.toEqual({
    success: true,
  });
  expect(signMessage).toHaveBeenCalledWith(
    "nonce|serial|number|42",
    token.id,
    "SHA256",
  );
  expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toMatchObject({
    challenge_response: "42",
  });
});

test.each([undefined, "99"])(
  "does not approve without a valid selection: %s",
  async (challenge_response) => {
    expect(
      (
        await handlePushAuthRequest(
          {
            ...request,
            challenge_type: "number" as const,
            challenge_choices: "17,42,86",
            challenge_response,
          },
          token,
        )
      ).success,
    ).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  },
);

test("reports a signed answer mismatch even on HTTP 200", async () => {
  fetchMock.mockResolvedValue(
    response(200, {
      result: { status: true, value: false },
      detail: { challenge_status: "challenge_mismatch" },
    }),
  );
  expect(
    await handlePushAuthRequest(
      {
        ...request,
        challenge_type: "number" as const,
        challenge_choices: "17,42,86",
        challenge_response: "17",
      },
      token,
    ),
  ).toMatchObject({ success: false, challengeMatched: false });
  expect(playNotificationSuccessHaptic).not.toHaveBeenCalled();
});

test.each([
  {},
  { result: { status: true, value: false } },
  { result: { status: false, value: true } },
])("fails closed for a rejected or malformed result: %j", async (body) => {
  fetchMock.mockResolvedValue(response(200, body));
  expect((await handlePushAuthRequest(request, token)).success).toBe(false);
});
