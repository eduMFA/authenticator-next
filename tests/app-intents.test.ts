import { handleAppIntents, publishTokenCatalog } from "@/services/app-intents";
import { useTokenStore } from "@/stores/token";
import * as AppIntents from "expo-app-intents";
import { router } from "expo-router";
jest.mock("@/services/push-auth", () => ({ handlePushAuthRequest: jest.fn() }));
import { token } from "./fixtures";

jest.mock("expo-app-intents", () => ({
  setEntityCatalogAsync: jest.fn(),
  removePendingInvocationAsync: jest.fn(),
}));
jest.mock("expo-router", () => ({ router: { navigate: jest.fn() } }));
jest.mock("@/services/token-rollout", () => ({
  startPendingRollouts: jest.fn(),
}));

function invocation(
  name: string,
  params: Record<string, unknown> = {},
  id = name,
): AppIntents.AppIntentInvocation {
  return { id, name, params, createdAt: Date.now() };
}

beforeEach(async () => {
  await useTokenStore.persist.rehydrate();
  useTokenStore.setState({ tokens: [token] });
  jest.mocked(AppIntents.setEntityCatalogAsync).mockResolvedValue(undefined);
  jest
    .mocked(AppIntents.removePendingInvocationAsync)
    .mockResolvedValue(undefined);
});

test("routes the entire cold-start snapshot and acknowledges each invocation", async () => {
  await handleAppIntents([
    invocation("openTokens"),
    invocation("pairToken"),
    invocation("openToken", { tokenId: token.id }),
  ]);

  expect(jest.mocked(router.navigate).mock.calls).toEqual([
    ["/"],
    ["/token/add"],
    [
      {
        pathname: "/token/[tokenId]",
        params: { tokenId: token.id, edit: "0" },
      },
    ],
  ]);
  expect(AppIntents.removePendingInvocationAsync).toHaveBeenCalledTimes(3);
  expect(useTokenStore.getState().tokens).toEqual([token]);
});

test.each([undefined, "", false, 42, "deleted"])(
  "reports and discards invalid token input %p without navigation",
  async (tokenId) => {
    await handleAppIntents([invocation("openToken", { tokenId })]);
    expect(router.navigate).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("invalid or deleted token"),
      "openToken",
    );
    expect(AppIntents.removePendingInvocationAsync).toHaveBeenCalledWith(
      "openToken",
    );
  },
);

test("reports unsupported actions and discards them without executing another action", async () => {
  await handleAppIntents([invocation("unknown")]);
  expect(router.navigate).not.toHaveBeenCalled();
  expect(console.warn).toHaveBeenCalledWith(
    "Discarding unsupported App Intent",
    "unknown",
    "unknown",
  );
  expect(AppIntents.removePendingInvocationAsync).toHaveBeenCalledWith(
    "unknown",
  );
});

test("retains a failed navigation while processing independent actions", async () => {
  jest.mocked(router.navigate).mockImplementationOnce(() => {
    throw new Error("Navigation unavailable");
  });
  const pending = invocation("openTokens");
  await handleAppIntents([pending, invocation("pairToken")]);
  expect(AppIntents.removePendingInvocationAsync).not.toHaveBeenCalledWith(
    pending.id,
  );
  expect(AppIntents.removePendingInvocationAsync).toHaveBeenCalledWith(
    "pairToken",
  );
  await handleAppIntents([pending]);
  expect(AppIntents.removePendingInvocationAsync).toHaveBeenCalledWith(
    pending.id,
  );
});

test("replays navigation and retries removal after acknowledgement fails", async () => {
  jest
    .mocked(AppIntents.removePendingInvocationAsync)
    .mockRejectedValueOnce(new Error("Storage unavailable"));
  const pending = invocation("openToken", { tokenId: token.id });
  await handleAppIntents([pending]);
  await handleAppIntents([pending]);
  expect(router.navigate).toHaveBeenCalledTimes(2);
  expect(AppIntents.removePendingInvocationAsync).toHaveBeenCalledTimes(2);
  expect(useTokenStore.getState().tokens).toEqual([token]);
});

test("publishes only compact display data, preserving IDs across renames and clearing deletions", async () => {
  await publishTokenCatalog([token]);
  expect(AppIntents.setEntityCatalogAsync).toHaveBeenLastCalledWith(
    "pushToken",
    [
      {
        id: token.id,
        title: token.label,
        subtitle: token.issuer,
        hideInSpotlight: true,
      },
    ],
  );
  await publishTokenCatalog([{ ...token, label: " Renamed " }]);
  expect(AppIntents.setEntityCatalogAsync).toHaveBeenLastCalledWith(
    "pushToken",
    [expect.objectContaining({ id: token.id, title: "Renamed" })],
  );
  await publishTokenCatalog([{ ...token, label: " ", issuer: " " }]);
  expect(AppIntents.setEntityCatalogAsync).toHaveBeenLastCalledWith(
    "pushToken",
    [
      expect.objectContaining({
        id: token.id,
        title: token.id,
        subtitle: undefined,
      }),
    ],
  );
  await publishTokenCatalog([]);
  expect(AppIntents.setEntityCatalogAsync).toHaveBeenLastCalledWith(
    "pushToken",
    [],
  );
});

test("serializes publications and recovers after a failed write", async () => {
  let rejectWrite: (error: Error) => void = () => {};
  jest.mocked(AppIntents.setEntityCatalogAsync).mockImplementationOnce(
    () =>
      new Promise<void>((_resolve, reject) => {
        rejectWrite = reject;
      }),
  );
  const first = publishTokenCatalog([token]);
  const failedWrite = expect(first).rejects.toThrow("Storage unavailable");
  const deletion = publishTokenCatalog([]);
  await Promise.resolve();
  expect(AppIntents.setEntityCatalogAsync).toHaveBeenCalledTimes(1);
  rejectWrite(new Error("Storage unavailable"));
  await failedWrite;
  await deletion;
  expect(AppIntents.setEntityCatalogAsync).toHaveBeenLastCalledWith(
    "pushToken",
    [],
  );
});
