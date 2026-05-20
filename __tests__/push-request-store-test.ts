import { usePushRequestStore } from "@/store/pushRequestStore";
import { PushRequest, PushRequestStatus } from "@/types";

const createRequest = (overrides: Partial<PushRequest> = {}): PushRequest => ({
  id: "request-1",
  nonce: "nonce-1",
  question: "Allow login?",
  sentAt: 1_000,
  serial: "PUSH0001",
  signature: "signature",
  sslverify: "1",
  status: PushRequestStatus.Pending,
  title: "Login",
  url: "https://mfa.example.com/validate",
  ...overrides,
});

describe("push request store", () => {
  beforeEach(() => {
    usePushRequestStore.setState({ pushRequests: [] });
    jest.restoreAllMocks();
  });

  test("adds requests and rejects duplicate ids or nonces", () => {
    const request = createRequest();

    expect(usePushRequestStore.getState().addPushRequest(request)).toBe(true);
    expect(usePushRequestStore.getState().addPushRequest(request)).toBe(false);
    expect(
      usePushRequestStore
        .getState()
        .addPushRequest(createRequest({ id: "request-2" })),
    ).toBe(false);

    expect(usePushRequestStore.getState().pushRequests).toEqual([request]);
  });

  test("updates, finds, removes, and clears requests", () => {
    const request = createRequest();
    usePushRequestStore.getState().addPushRequest(request);

    usePushRequestStore
      .getState()
      .updatePushRequestStatus(request.id, PushRequestStatus.Accepted);

    expect(usePushRequestStore.getState().getPushRequestById(request.id)).toMatchObject(
      { status: PushRequestStatus.Accepted },
    );
    expect(
      usePushRequestStore.getState().getPushRequestByNonce(request.nonce),
    ).toMatchObject({ id: request.id });
    expect(usePushRequestStore.getState().getPendingPushRequests()).toEqual([]);

    usePushRequestStore.getState().removePushRequest(request.id);
    expect(usePushRequestStore.getState().pushRequests).toEqual([]);

    usePushRequestStore.getState().addPushRequest(request);
    usePushRequestStore.getState().clearPushRequests();
    expect(usePushRequestStore.getState().pushRequests).toEqual([]);
  });

  test("marks only stale pending requests as expired", () => {
    jest.spyOn(Date, "now").mockReturnValue(10_000);

    const stalePendingRequest = createRequest({
      id: "stale",
      nonce: "stale-nonce",
      sentAt: 1_000,
    });
    const freshPendingRequest = createRequest({
      id: "fresh",
      nonce: "fresh-nonce",
      sentAt: 9_000,
    });
    const staleAcceptedRequest = createRequest({
      id: "accepted",
      nonce: "accepted-nonce",
      sentAt: 1_000,
      status: PushRequestStatus.Accepted,
    });

    usePushRequestStore.getState().addPushRequest(stalePendingRequest);
    usePushRequestStore.getState().addPushRequest(freshPendingRequest);
    usePushRequestStore.getState().addPushRequest(staleAcceptedRequest);

    usePushRequestStore.getState().clearExpiredPushRequests(5_000);

    expect(usePushRequestStore.getState().pushRequests).toEqual([
      { ...stalePendingRequest, status: PushRequestStatus.Expired },
      freshPendingRequest,
      staleAcceptedRequest,
    ]);
  });
});
