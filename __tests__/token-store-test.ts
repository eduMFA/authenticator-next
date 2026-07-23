jest.mock("@/services/token-rollout", () => ({
  __esModule: true,
  isTokenRollingOut: jest.fn(),
  performTokenRollout: jest.fn(),
  startPendingRollouts: jest.fn(),
}));

import {
  isTokenRollingOut,
  performTokenRollout,
  startPendingRollouts,
} from "@/services/token-rollout";
import { useTokenStore } from "@/stores/token";
import type { PushToken } from "@/types/token";
import { PushTokenRolloutState } from "@/types/token";

const mockIsTokenRollingOut = isTokenRollingOut as jest.Mock;
const mockPerformTokenRollout = performTokenRollout as jest.Mock;
const mockStartPendingRollouts = startPendingRollouts as jest.Mock;

const createToken = (overrides: Partial<PushToken> = {}): PushToken => ({
  callbackUrl: "https://mfa.example.com/validate",
  enrollmentCredential: "credential",
  id: "PUSH0001",
  label: "alice@example.com",
  rolloutState: PushTokenRolloutState.Pending,
  sslVerify: true,
  ttl: 10,
  version: 1,
  ...overrides,
});

describe("token store", () => {
  beforeEach(() => {
    useTokenStore.setState({ tokens: [] });
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("adds tokens once", () => {
    const token = createToken();

    useTokenStore.getState().addToken(token);
    useTokenStore.getState().addToken(token);

    expect(useTokenStore.getState().tokens).toEqual([token]);
  });

  test("updates and removes tokens", () => {
    const token = createToken();
    useTokenStore.getState().addToken(token);

    useTokenStore.getState().updateToken(token.id, { label: "Alice" });
    expect(useTokenStore.getState().tokens[0]).toMatchObject({
      id: token.id,
      label: "Alice",
    });

    useTokenStore.getState().removeToken(token.id);
    expect(useTokenStore.getState().tokens).toEqual([]);
  });

  test("throws when updating or rolling out a missing token", async () => {
    expect(() =>
      useTokenStore.getState().updateToken("missing", { label: "Missing" }),
    ).toThrow("Token not found");

    await expect(useTokenStore.getState().rolloutToken("missing")).rejects.toThrow(
      "Token not found",
    );
  });

  test("delegates rollout and rethrows rollout errors", async () => {
    const token = createToken();
    const error = new Error("rollout failed");
    useTokenStore.getState().addToken(token);

    mockPerformTokenRollout.mockResolvedValueOnce({ success: true });
    await expect(useTokenStore.getState().rolloutToken(token.id)).resolves.toBe(
      undefined,
    );
    expect(mockPerformTokenRollout).toHaveBeenCalledWith(
      token,
      expect.any(Function),
    );

    mockPerformTokenRollout.mockResolvedValueOnce({
      success: false,
      error,
    });
    await expect(useTokenStore.getState().rolloutToken(token.id)).rejects.toThrow(
      error,
    );
  });

  test("delegates rollout status helpers", () => {
    mockIsTokenRollingOut.mockReturnValue(true);

    expect(useTokenStore.getState().isRollingOut("PUSH0001")).toBe(true);
    expect(mockIsTokenRollingOut).toHaveBeenCalledWith("PUSH0001");
  });

  test("starts pending rollouts with live token state", () => {
    const token = createToken();
    useTokenStore.getState().addToken(token);

    useTokenStore.getState().startPendingRollouts();

    expect(mockStartPendingRollouts).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
    );
    const [getTokens] = mockStartPendingRollouts.mock.calls[0];
    expect(getTokens()).toEqual([token]);
  });
});
