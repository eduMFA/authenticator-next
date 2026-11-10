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

test("does not treat HTTP 200 with a rejected signature as approval", async () => {
  fetchMock.mockResolvedValue(
    response(200, { result: { status: true, value: false } }),
  );
  expect((await handlePushAuthRequest(request, token)).success).toBe(false);
  expect(playNotificationSuccessHaptic).not.toHaveBeenCalled();
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
      signal: expect.any(AbortSignal),
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
test("aborts an unresponsive server and allows a later response attempt", async () => {
  jest.useFakeTimers();
  try {
    fetchMock.mockImplementationOnce((_url, options) => {
      const signal = options?.signal;
      if (!signal) throw new Error("Missing abort signal");
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("Aborted")));
      });
    });

    const pendingResponse = handlePushAuthRequest(request, token);
    await jest.advanceTimersByTimeAsync(10_000);
    await expect(pendingResponse).resolves.toEqual({
      success: false,
      error: new Error("The server did not respond in time."),
    });
    expect(playNotificationSuccessHaptic).not.toHaveBeenCalled();
    await expect(handlePushAuthRequest(request, token)).resolves.toEqual({
      success: true,
    });
  } finally {
    jest.useRealTimers();
  }
});
test("matches serial and handles unknown tokens", () => {
  expect(
    findTokenForPushRequest(request, [{ ...token, id: "other" }, token]),
  ).toBe(token);
  expect(findTokenForPushRequest(request, [])).toBeUndefined();
});
