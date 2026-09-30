import * as Sentry from "@sentry/react-native";
import { isRunningInExpoGo } from "expo";
import {
  setSentryTrackingEnabled,
  submitUserFeedback,
  withSentryRoot,
} from "@/utils/sentry";
import type { ErrorEvent } from "@sentry/react-native";

jest.mock("expo", () => ({ isRunningInExpoGo: jest.fn(() => false) }));
jest.mock("@sentry/react-native", () => ({
  init: jest.fn(),
  close: jest.fn(() => Promise.resolve(true)),
  wrap: jest.fn((component: unknown) => component),
  feedbackIntegration: jest.fn(() => ({})),
  withScope: jest.fn(),
  captureFeedback: jest.fn(),
}));
beforeEach(() => {
  setSentryTrackingEnabled(false);
  jest.clearAllMocks();
});
function options() {
  const config = jest.mocked(Sentry.init).mock.calls.at(-1)?.[0];
  if (!config) throw new Error("Sentry was not initialized");
  return config;
}

test("bootstraps root without collecting errors and wraps once", async () => {
  const component = () => null;
  expect(withSentryRoot(component)).toBe(component);
  withSentryRoot(component);
  expect(Sentry.init).toHaveBeenCalledTimes(1);
  expect(Sentry.wrap).toHaveBeenCalledTimes(2);
  expect(options()).toMatchObject({
    enableNative: false,
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });
  expect(
    await options().beforeSend?.({ type: undefined, message: "error" }, {}),
  ).toBeNull();
});
test("respects consent, avoids duplicate initialization, and closes on opt-out", async () => {
  setSentryTrackingEnabled(true);
  setSentryTrackingEnabled(true);
  expect(Sentry.init).toHaveBeenCalledTimes(1);
  expect(options().enableNative).toBe(true);
  const beforeSend = options().beforeSend;
  setSentryTrackingEnabled(false);
  setSentryTrackingEnabled(false);
  expect(Sentry.close).toHaveBeenCalledTimes(1);
  expect(
    await beforeSend?.({ type: undefined, message: "error" }, {}),
  ).toBeNull();
});
test("disables native reporting in Expo Go and tolerates close errors", async () => {
  jest.mocked(isRunningInExpoGo).mockReturnValueOnce(true);
  setSentryTrackingEnabled(true);
  expect(options().enableNative).toBe(false);
  jest.mocked(Sentry.close).mockRejectedValueOnce(new Error("close failed"));
  setSentryTrackingEnabled(false);
  await Promise.resolve();
  expect(console.warn).toHaveBeenCalled();
});
test("allows explicit feedback with reporting disabled", async () => {
  const setTag = jest.fn();
  jest
    .mocked(Sentry.withScope)
    .mockImplementationOnce((callback) =>
      callback({ setTag } as unknown as Sentry.Scope),
    );
  submitUserFeedback(
    { message: "Feature request", email: "user@example.org", name: "User" },
    "feature_request",
  );
  expect(setTag).toHaveBeenCalledWith("feedback.type", "feature_request");
  expect(Sentry.captureFeedback).toHaveBeenCalledWith({
    message: "Feature request",
    email: "user@example.org",
    name: "User",
    source: "settings",
  });
  const feedback = { type: "feedback" } as unknown as ErrorEvent;
  expect(await options().beforeSend?.(feedback, {})).toBe(feedback);
  setSentryTrackingEnabled(true);
  jest.clearAllMocks();
  submitUserFeedback({ message: "Bug" }, "bug_report");
  expect(Sentry.init).not.toHaveBeenCalled();
});
test("sanitizes sensitive fields, auth URIs, circular structures and event metadata", async () => {
  setSentryTrackingEnabled(true);
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  const event: ErrorEvent = {
    type: undefined,
    message: "Failed otpauth://totp/account?secret=secret",
    user: { email: "private@example.org" },
    request: { url: "https://private.org" },
    logentry: {
      message: "otpauth://totp/test",
      params: ["otpauth://totp/test", null, 42],
    },
    exception: { values: [{ value: "otpauth://totp/test" }, {}] },
    breadcrumbs: [
      {
        message: "otpauth://totp/test",
        data: { password: "secret", safe: true },
      },
      {},
    ],
    contexts: {
      custom: { nested: { credential: "secret", list: [1, "safe", null] } },
    },
    extra: {
      pin: "1234",
      token: "private",
      url: "private",
      circular,
      safe: "allowed",
    },
    tags: { environment: "test" },
  };
  const sanitized = await options().beforeSend?.(event, {});
  expect(sanitized).toMatchObject({
    message: "Failed otpauth://[Filtered]",
    logentry: {
      message: "otpauth://[Filtered]",
      params: ["otpauth://[Filtered]", null, 42],
    },
    extra: {
      pin: "[Filtered]",
      token: "[Filtered]",
      url: "[Filtered]",
      circular: { self: "[Circular]" },
      safe: "allowed",
    },
    contexts: {
      custom: { nested: { credential: "[Filtered]", list: [1, "safe", null] } },
    },
  });
  expect(sanitized).not.toHaveProperty("user");
  expect(sanitized).not.toHaveProperty("request");
  expect(event.user).toEqual({ email: "private@example.org" });
  expect(await options().beforeSend?.({ type: undefined }, {})).toMatchObject({
    message: undefined,
    logentry: undefined,
    exception: undefined,
  });
  expect(
    options().beforeBreadcrumb?.(
      { message: "otpauth://totp/test", data: { authorization: "private" } },
      {},
    ),
  ).toEqual({
    message: "otpauth://[Filtered]",
    data: { authorization: "[Filtered]" },
  });
});
