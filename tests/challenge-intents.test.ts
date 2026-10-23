import {
  handleAppIntents,
  publishChallengeCatalog,
} from "@/services/app-intents";
import { handlePushAuthRequest } from "@/services/push-auth";
import { usePushRequestStore } from "@/stores/push-request";
import { useTokenStore } from "@/stores/token";
import { PushRequestStatus } from "@/types/push-request";
import { PushTokenRolloutState } from "@/types/token";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as AppIntents from "expo-app-intents";
import { request, token } from "./fixtures";

jest.mock("expo-app-intents", () => ({
  setEntityCatalogAsync: jest.fn(),
  removePendingInvocationAsync: jest.fn(),
}));
jest.mock("expo-router", () => ({ router: { navigate: jest.fn() } }));
jest.mock("@/services/token-rollout", () => ({
  startPendingRollouts: jest.fn(),
}));
jest.mock("@/services/push-auth", () => ({ handlePushAuthRequest: jest.fn() }));

const now = 1000000;
function invocation(
  approve: unknown = true,
  id = "intent",
): AppIntents.AppIntentInvocation {
  return {
    id,
    name: "respondToChallenge",
    params: { requestId: request.id, approve },
    createdAt: now,
  };
}

beforeEach(async () => {
  jest.spyOn(Date, "now").mockReturnValue(now);
  await useTokenStore.persist.rehydrate();
  await usePushRequestStore.persist.rehydrate();
  useTokenStore.setState({
    tokens: [{ ...token, rolloutState: PushTokenRolloutState.Completed }],
  });
  usePushRequestStore.setState({
    pushRequests: [{ ...request, sentAt: now }],
    intentResponses: {},
  });
  jest.mocked(handlePushAuthRequest).mockResolvedValue({ success: true });
  jest
    .mocked(AppIntents.removePendingInvocationAsync)
    .mockResolvedValue(undefined);
  jest.mocked(AppIntents.setEntityCatalogAsync).mockResolvedValue(undefined);
});

test.each([true, false])(
  "submits the explicit decision %s and durably commits status and invocation ID",
  async (approve) => {
    const result = jest.fn();
    await handleAppIntents([invocation(approve)], result);
    const status = approve
      ? PushRequestStatus.Accepted
      : PushRequestStatus.Declined;
    expect(handlePushAuthRequest).toHaveBeenCalledWith(
      expect.objectContaining({ id: request.id, status }),
      expect.objectContaining({ id: token.id }),
    );
    const snapshot = await usePushRequestStore.persist
      .getOptions()
      .storage?.getItem("push-request-storage");
    expect(snapshot?.state.intentResponses.intent).toEqual({
      requestId: request.id,
      approve,
      state: "completed",
    });
    expect(snapshot?.state.pushRequests[0].status).toBe(status);
    expect(result).toHaveBeenCalledWith();
    expect(AppIntents.removePendingInvocationAsync).toHaveBeenCalledWith(
      "intent",
    );
  },
);

test("removal failure followed by hydration replays only the acknowledgement", async () => {
  jest
    .mocked(AppIntents.removePendingInvocationAsync)
    .mockRejectedValueOnce(new Error("Storage unavailable"));
  const result = jest.fn();
  await handleAppIntents([invocation()], result);
  expect(result).toHaveBeenCalledTimes(1);
  expect(result).toHaveBeenCalledWith();
  await usePushRequestStore.persist.rehydrate();
  await handleAppIntents([invocation()]);
  expect(handlePushAuthRequest).toHaveBeenCalledTimes(1);
  expect(AppIntents.removePendingInvocationAsync).toHaveBeenCalledTimes(2);
});

test.each(["submitting", "uncertain"] as const)(
  "does not resubmit a durable %s attempt after restart",
  async (state) => {
    await usePushRequestStore
      .getState()
      .saveIntentResponse(
        "intent",
        { requestId: request.id, approve: true, state },
        PushRequestStatus.Accepted,
      );
    await usePushRequestStore.persist.rehydrate();
    const result = jest.fn();
    await handleAppIntents([invocation()], result);
    expect(handlePushAuthRequest).not.toHaveBeenCalled();
    expect(result).toHaveBeenCalledWith(expect.any(Error));
    expect(
      usePushRequestStore.getState().getPushRequestById(request.id)?.status,
    ).toBe(PushRequestStatus.Pending);
    await handleAppIntents([invocation(false, "another-intent")]);
    expect(handlePushAuthRequest).not.toHaveBeenCalled();
  },
);

test("failed submission restores the review flow and never automatically resubmits", async () => {
  jest
    .mocked(handlePushAuthRequest)
    .mockResolvedValue({ success: false, error: new Error("offline") });
  const result = jest.fn();
  await handleAppIntents([invocation(false)], result);
  expect(result).toHaveBeenCalledWith(expect.any(Error));
  expect(
    usePushRequestStore.getState().getPushRequestById(request.id)?.status,
  ).toBe(PushRequestStatus.Pending);
  await handleAppIntents([invocation(false)]);
  expect(handlePushAuthRequest).toHaveBeenCalledTimes(1);
});

test.each([undefined, "", "true", 1, null])(
  "rejects invalid approval input %p before mutation",
  async (approve) => {
    const action = invocation();
    action.params.approve = approve;
    await handleAppIntents([action]);
    expect(handlePushAuthRequest).not.toHaveBeenCalled();
    expect(usePushRequestStore.getState().intentResponses).toEqual({});
  },
);

test.each([
  "missing",
  "expired",
  "handled",
  "deleted-token",
  "not-enrolled",
  "old-invocation",
])("rejects %s requests without submitting", async (condition) => {
  const action = invocation();
  if (condition === "missing") action.params.requestId = "missing";
  if (condition === "expired")
    usePushRequestStore.setState({
      pushRequests: [{ ...request, sentAt: now - 120000 }],
    });
  if (condition === "handled")
    usePushRequestStore
      .getState()
      .updatePushRequestStatus(request.id, PushRequestStatus.Accepted);
  if (condition === "deleted-token") useTokenStore.setState({ tokens: [] });
  if (condition === "not-enrolled") useTokenStore.setState({ tokens: [token] });
  if (condition === "old-invocation") action.createdAt = now - 120000;
  await handleAppIntents([action]);
  expect(handlePushAuthRequest).not.toHaveBeenCalled();
  expect(AppIntents.removePendingInvocationAsync).toHaveBeenCalledWith(
    action.id,
  );
});

test("rejects altered replay parameters", async () => {
  await handleAppIntents([invocation(true)]);
  const result = jest.fn();
  await handleAppIntents([invocation(false)], result);
  expect(handlePushAuthRequest).toHaveBeenCalledTimes(1);
  expect(result).toHaveBeenCalledWith(expect.any(Error));
});

test("never sends before the durable attempt write succeeds", async () => {
  const save = jest
    .spyOn(usePushRequestStore.getState(), "saveIntentResponse")
    .mockRejectedValue(new Error("Disk full"));
  await handleAppIntents([invocation()]);
  expect(save).toHaveBeenCalled();
  expect(handlePushAuthRequest).not.toHaveBeenCalled();
  expect(AppIntents.removePendingInvocationAsync).not.toHaveBeenCalled();
});

test("retries a failed completion write without resending the response", async () => {
  jest
    .mocked(AsyncStorage.setItem)
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error("Disk full"));
  const result = jest.fn();
  await handleAppIntents([invocation()], result);
  expect(handlePushAuthRequest).toHaveBeenCalledTimes(1);
  expect(result).toHaveBeenCalledWith(expect.any(Error));
  expect(AppIntents.removePendingInvocationAsync).not.toHaveBeenCalled();
  await handleAppIntents([invocation()]);
  expect(handlePushAuthRequest).toHaveBeenCalledTimes(1);
  expect(AppIntents.removePendingInvocationAsync).toHaveBeenCalledWith(
    "intent",
  );
});

test("publishes only current request display data and expiration, then clears an empty catalog", async () => {
  const current = { ...request, sentAt: now };
  await publishChallengeCatalog(
    [
      current,
      { ...current, id: "expired", sentAt: now - 120000 },
      { ...current, id: "handled", status: PushRequestStatus.Accepted },
      { ...current, id: "orphan", serial: "missing" },
    ],
    [token],
  );
  expect(AppIntents.setEntityCatalogAsync).toHaveBeenLastCalledWith(
    "pushChallenge",
    [
      {
        id: request.id,
        title: request.title,
        subtitle: `${token.label} · ${request.question}`,
        metadata: { expiresAt: String(now + 120000) },
        hideInSpotlight: true,
      },
    ],
  );
  await publishChallengeCatalog([], [token]);
  expect(AppIntents.setEntityCatalogAsync).toHaveBeenLastCalledWith(
    "pushChallenge",
    [],
  );
});
