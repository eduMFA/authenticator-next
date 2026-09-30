import { usePushRequestStore } from "@/stores/push-request";
import { PushRequestStatus as Status } from "@/types/push-request";
import { request } from "./fixtures";

beforeEach(async () => {
  await usePushRequestStore.persist.rehydrate();
  usePushRequestStore.getState().clearPushRequests();
});

test("adds requests once by id or nonce and looks them up", () => {
  const store = usePushRequestStore.getState();
  expect(store.addPushRequest(request)).toBe(true);
  expect(store.addPushRequest({ ...request, nonce: "other" })).toBe(false);
  expect(store.addPushRequest({ ...request, id: "other" })).toBe(false);
  expect(
    store.addPushRequest({ ...request, id: "second", nonce: "second" }),
  ).toBe(true);
  expect(store.getPushRequestById(request.id)).toEqual(request);
  expect(store.getPushRequestByNonce(request.nonce)).toEqual(request);
  expect(store.getPushRequestById("missing")).toBeUndefined();
  expect(store.getPushRequestByNonce("missing")).toBeUndefined();
});
test("updates only matching request and returns pending requests", () => {
  const store = usePushRequestStore.getState();
  store.addPushRequest(request);
  store.addPushRequest({ ...request, id: "second", nonce: "second" });
  store.updatePushRequestStatus(request.id, Status.Accepted);
  store.updatePushRequestStatus("missing", Status.Declined);
  expect(store.getPushRequestById(request.id)?.status).toBe(Status.Accepted);
  expect(store.getPendingPushRequests().map((entry) => entry.id)).toEqual([
    "second",
  ]);
  store.removePushRequest(request.id);
  expect(store.getPushRequestById(request.id)).toBeUndefined();
  expect(store.getPendingPushRequests()).toHaveLength(1);
  store.clearPushRequests();
  expect(store.getPendingPushRequests()).toEqual([]);
});
test("expires pending requests at age boundary while preserving recent and handled requests", () => {
  jest.spyOn(Date, "now").mockReturnValue(121000);
  const store = usePushRequestStore.getState();
  store.addPushRequest(request);
  store.addPushRequest({
    ...request,
    id: "recent",
    nonce: "recent",
    sentAt: 1001,
  });
  store.addPushRequest({
    ...request,
    id: "accepted",
    nonce: "accepted",
    status: Status.Accepted,
  });
  store.clearExpiredPushRequests();
  expect(store.getPushRequestById(request.id)?.status).toBe(Status.Expired);
  expect(store.getPushRequestById("recent")?.status).toBe(Status.Pending);
  expect(store.getPushRequestById("accepted")?.status).toBe(Status.Accepted);
  store.clearExpiredPushRequests(1);
  expect(store.getPendingPushRequests()).toEqual([]);
  expect(usePushRequestStore.getState().pushRequests).toHaveLength(3);
});
test("persists requests and restores them on hydration", async () => {
  usePushRequestStore.getState().addPushRequest(request);
  // Bypass the action to simulate loss of in-memory state without writing storage.
  const persisted = usePushRequestStore.persist.getOptions().storage;
  const snapshot = await persisted?.getItem("push-request-storage");
  expect(snapshot?.state.pushRequests).toEqual([request]);
  usePushRequestStore.setState({ pushRequests: [] });
  await persisted?.setItem("push-request-storage", snapshot!);
  await usePushRequestStore.persist.rehydrate();
  expect(usePushRequestStore.getState().pushRequests).toEqual([request]);
});
