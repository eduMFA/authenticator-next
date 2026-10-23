/** @jest-environment ./tests/http-environment.cjs */
import { handleAppIntents } from "@/services/app-intents";
import { usePushRequestStore } from "@/stores/push-request";
import { useTokenStore } from "@/stores/token";
import { PushRequestStatus } from "@/types/push-request";
import { PushTokenRolloutState } from "@/types/token";
import { request, token } from "./fixtures";

jest.mock("expo-app-intents", () => ({
  removePendingInvocationAsync: jest.fn(),
}));
jest.mock("expo-router", () => ({ router: { navigate: jest.fn() } }));
jest.mock("@/services/token-rollout", () => ({
  startPendingRollouts: jest.fn(),
}));
jest.mock("@/utils/rsa", () => ({
  signMessage: jest.fn().mockResolvedValue("Zg=="),
}));
jest.mock("@/utils/haptics", () => ({
  playNotificationSuccessHaptic: jest.fn(),
  playNotificationWarningHaptic: jest.fn(),
}));

const simulationUrl = process.env.APP_INTENTS_SIMULATION_URL;
const simulationTest = simulationUrl ? test : test.skip;
declare const httpFetch: typeof fetch;

beforeEach(() => {
  globalThis.fetch = httpFetch;
});

simulationTest.each([true, false])(
  "sends decision %s over real HTTP through the intent handler",
  async (approve) => {
    await useTokenStore.persist.rehydrate();
    await usePushRequestStore.persist.rehydrate();
    const now = Date.now();
    const status = approve
      ? PushRequestStatus.Accepted
      : PushRequestStatus.Declined;
    useTokenStore.setState({
      tokens: [
        {
          ...token,
          rolloutState: PushTokenRolloutState.Completed,
          callbackUrl: `${simulationUrl}/push`,
        },
      ],
    });
    usePushRequestStore.setState({
      pushRequests: [{ ...request, sentAt: now }],
      intentResponses: {},
    });
    const result = jest.fn();
    await handleAppIntents(
      [
        {
          id: `http-${approve}`,
          name: "respondToChallenge",
          createdAt: now,
          params: { requestId: request.id, approve },
        },
      ],
      result,
    );
    expect(result).toHaveBeenCalledWith();
    expect(
      usePushRequestStore.getState().getPushRequestById(request.id)?.status,
    ).toBe(status);
  },
);

simulationTest(
  "retains the review flow when the server rejects the response",
  async () => {
    const now = Date.now();
    useTokenStore.setState({
      tokens: [
        {
          ...token,
          rolloutState: PushTokenRolloutState.Completed,
          callbackUrl: `${simulationUrl}/fail`,
        },
      ],
    });
    usePushRequestStore.setState({
      pushRequests: [{ ...request, sentAt: now }],
      intentResponses: {},
    });
    const result = jest.fn();
    await handleAppIntents(
      [
        {
          id: "http-failure",
          name: "respondToChallenge",
          createdAt: now,
          params: { requestId: request.id, approve: false },
        },
      ],
      result,
    );
    expect(result).toHaveBeenCalledWith(expect.any(Error));
    expect(
      usePushRequestStore.getState().getPushRequestById(request.id)?.status,
    ).toBe(PushRequestStatus.Pending);
    expect(
      usePushRequestStore.getState().intentResponses["http-failure"].state,
    ).toBe("uncertain");
  },
);
