import { useTokenStore } from "@/stores/token";
import {
  isTokenRollingOut,
  performTokenRollout,
  startPendingRollouts,
} from "@/services/token-rollout";
import { token } from "./fixtures";

jest.mock("@/services/token-rollout", () => ({
  isTokenRollingOut: jest.fn(),
  performTokenRollout: jest.fn(),
  startPendingRollouts: jest.fn(),
}));
beforeEach(async () => {
  jest.useFakeTimers();
  await useTokenStore.persist.rehydrate();
  jest.runOnlyPendingTimers();
  jest.clearAllMocks();
  useTokenStore.setState({ tokens: [] });
  jest.mocked(performTokenRollout).mockResolvedValue({ success: true });
});
afterEach(() => jest.useRealTimers());

test("adds unique tokens, updates only matching token, and removes tokens", () => {
  const store = useTokenStore.getState();
  store.addToken(token);
  store.addToken({ ...token, label: "duplicate" });
  store.addToken({ ...token, id: "other" });
  expect(useTokenStore.getState().tokens).toHaveLength(2);
  store.updateToken(token.id, { label: "updated" });
  expect(useTokenStore.getState().tokens.map((entry) => entry.label)).toEqual([
    "updated",
    token.label,
  ]);
  expect(() => store.updateToken("missing", {})).toThrow("Token not found");
  store.removeToken(token.id);
  expect(useTokenStore.getState().tokens.map((entry) => entry.id)).toEqual([
    "other",
  ]);
});
test("delegates rollout and propagates errors", async () => {
  const store = useTokenStore.getState();
  await expect(store.rolloutToken("missing")).rejects.toThrow(
    "Token not found",
  );
  store.addToken(token);
  await expect(store.rolloutToken(token.id)).resolves.toBeUndefined();
  expect(performTokenRollout).toHaveBeenCalledWith(token, store.updateToken);
  jest
    .mocked(performTokenRollout)
    .mockResolvedValue({ success: false, error: new Error("offline") });
  await expect(store.rolloutToken(token.id)).rejects.toThrow("offline");
  jest.mocked(performTokenRollout).mockResolvedValue({ success: false });
  await expect(store.rolloutToken(token.id)).resolves.toBeUndefined();
});
test("delegates pending rollout using current state", () => {
  const store = useTokenStore.getState();
  store.startPendingRollouts();
  const [getTokens, updateToken] =
    jest.mocked(startPendingRollouts).mock.calls[0];
  store.addToken(token);
  expect(getTokens()).toEqual([token]);
  expect(updateToken).toBe(store.updateToken);
  jest.mocked(isTokenRollingOut).mockReturnValue(true);
  expect(store.isRollingOut(token.id)).toBe(true);
  expect(isTokenRollingOut).toHaveBeenCalledWith(token.id);
});
test("starts pending rollouts after rehydration", async () => {
  await useTokenStore.persist.rehydrate();
  expect(startPendingRollouts).not.toHaveBeenCalled();
  jest.advanceTimersByTime(100);
  expect(startPendingRollouts).toHaveBeenCalledTimes(1);
  const snapshot = await useTokenStore.persist
    .getOptions()
    .storage?.getItem("token-storage");
  expect(Object.keys(snapshot?.state ?? {})).toEqual(["tokens"]);
});
