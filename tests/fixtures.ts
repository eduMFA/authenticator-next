import { PushTokenRolloutState, type PushToken } from "@/types/token";
import { PushRequestStatus, type PushRequest } from "@/types/push-request";

export const token: PushToken = {
  id: "serial",
  version: 1,
  label: "Account",
  callbackUrl: "https://example.org/push",
  ttl: 10,
  enrollmentCredential: "credential",
  sslVerify: true,
  rolloutState: PushTokenRolloutState.Pending,
};
export const request: PushRequest = {
  id: "request",
  nonce: "nonce",
  serial: token.id,
  question: "Sign in?",
  title: "Login",
  signature: "MY======",
  sslverify: "1",
  url: token.callbackUrl,
  sentAt: 1000,
  status: PushRequestStatus.Pending,
};
export function response(status = 200, body: unknown = {}): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response;
}

export function deferred<T>() {
  let resolve: (value: T) => void = () => {
    throw new Error("Deferred promise was not initialized");
  };
  const promise = new Promise<T>((fulfill) => {
    resolve = fulfill;
  });
  return { promise, resolve };
}
