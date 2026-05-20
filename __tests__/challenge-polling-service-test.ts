jest.mock("@/utils/rsa", () => ({
  __esModule: true,
  signMessage: jest.fn(),
  verifyMessage: jest.fn(),
}));

import {
  pollAllChallenges,
  pollChallengesForToken,
} from "@/services/challengePollingService";
import { PushToken, PushTokenRolloutState } from "@/types";
import { base64ToBase32 } from "@/utils/crypto";
import { buildPushRequestSignedData } from "@/utils/pushRequestUtils";
import { signMessage, verifyMessage } from "@/utils/rsa";

const mockSignMessage = signMessage as jest.Mock;
const mockVerifyMessage = verifyMessage as jest.Mock;

const createToken = (overrides: Partial<PushToken> = {}): PushToken => ({
  callbackUrl: "https://mfa.example.com/poll",
  enrollmentCredential: "credential",
  id: "PUSH0001",
  label: "alice@example.com",
  rolloutState: PushTokenRolloutState.Completed,
  sslVerify: true,
  ttl: 10,
  version: 1,
  ...overrides,
});

const createChallenge = () => ({
  nonce: "nonce-1",
  question: "Allow login?",
  serial: "PUSH0001",
  signature: base64ToBase32("c2ln"),
  sslverify: "1",
  title: "Login",
  url: "https://mfa.example.com/validate",
});

describe("challenge polling service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(Date, "now").mockReturnValue(123_456);
    mockSignMessage.mockResolvedValue("cG9sbC1zaWduYXR1cmU=");
    mockVerifyMessage.mockResolvedValue(true);
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        result: {
          value: [createChallenge()],
        },
      }),
    }) as jest.Mock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("polls a token and parses available challenges", async () => {
    const token = createToken();

    await expect(pollChallengesForToken(token)).resolves.toEqual({
      success: true,
      challenges: [
        {
          id: "poll-nonce-1-123456",
          nonce: "nonce-1",
          question: "Allow login?",
          sentAt: 123_456,
          serial: "PUSH0001",
          signature: base64ToBase32("c2ln"),
          sslverify: "1",
          status: "pending",
          title: "Login",
          url: "https://mfa.example.com/validate",
        },
      ],
    });

    const [url, options] = (globalThis.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("https://mfa.example.com/poll?");
    expect(url).toContain("serial=PUSH0001");
    expect(url).toContain("signature=");
    expect(options).toEqual({
      method: "GET",
      headers: { Accept: "application/json" },
    });
  });

  test("verifies signed challenges when the token has a server public key", async () => {
    const token = createToken({ serverPublicKey: "server-public-key" });
    const challenge = createChallenge();

    await pollChallengesForToken(token);

    expect(mockVerifyMessage).toHaveBeenCalledWith(
      buildPushRequestSignedData(challenge),
      "c2ln",
      "server-public-key",
    );
  });

  test("filters challenges with invalid server signatures", async () => {
    mockVerifyMessage.mockResolvedValueOnce(false);

    await expect(
      pollChallengesForToken(
        createToken({ serverPublicKey: "server-public-key" }),
      ),
    ).resolves.toEqual({
      success: true,
      challenges: [],
    });
  });

  test("treats 204 and 404 responses as empty successful polls", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({ status: 204 });
    await expect(pollChallengesForToken(createToken())).resolves.toEqual({
      success: true,
      challenges: [],
    });

    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({ status: 404 });
    await expect(pollChallengesForToken(createToken())).resolves.toEqual({
      success: true,
      challenges: [],
    });
  });

  test("returns server polling errors", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue("server error"),
    });

    await expect(pollChallengesForToken(createToken())).resolves.toMatchObject({
      success: false,
      challenges: [],
      error: expect.any(Error),
    });
  });

  test("polls only completed tokens and aggregates errors", async () => {
    const completedToken = createToken({ id: "PUSH0001" });
    const pendingToken = createToken({
      id: "PUSH0002",
      rolloutState: PushTokenRolloutState.Pending,
    });

    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: jest.fn().mockResolvedValue("unavailable"),
    });

    await expect(
      pollAllChallenges([completedToken, pendingToken]),
    ).resolves.toMatchObject({
      success: false,
      challenges: [],
      error: expect.any(Error),
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    await expect(pollAllChallenges([pendingToken])).resolves.toEqual({
      success: true,
      challenges: [],
    });
  });
});
