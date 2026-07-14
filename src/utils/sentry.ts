import type { Breadcrumb, ErrorEvent, Exception } from "@sentry/react-native";
import * as Sentry from "@sentry/react-native";
import { isRunningInExpoGo } from "expo";
import type { ComponentType } from "react";

const SENTRY_DSN =
  "https://c75bcaf61c8d79c8bcc0896d3598179a@sentry.edumfa.io/31";
const SENTRY_ENVIRONMENT =
  process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ??
  (__DEV__ ? "development" : "production");

const SENSITIVE_FIELD_NAME_PATTERN =
  /(authorization|credential|password|pin|secret|token|otp|uri|url)/i;
const OTP_AUTH_URI_PATTERN = /otpauth:\/\/[^\s"'<>)]*/gi;

let sentryInitialized = false;

export function setSentryTrackingEnabled(enabled: boolean): void {
  if (enabled) {
    initSentry();
    return;
  }

  if (!sentryInitialized) {
    return;
  }

  sentryInitialized = false;

  void Sentry.close().catch((error: unknown) => {
    if (__DEV__) {
      console.warn("Failed to close Sentry:", error);
    }
  });
}

function initSentry(): void {
  if (sentryInitialized) {
    return;
  }

  const enableNative = !isRunningInExpoGo();

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    debug: false,
    sendDefaultPii: false,
    sampleRate: 1,
    maxBreadcrumbs: 30,
    maxCacheItems: 20,
    attachScreenshot: false,
    attachViewHierarchy: false,
    attachThreads: false,
    enableAutoSessionTracking: false,
    enableCaptureFailedRequests: false,
    enableLogs: false,
    enableNative,
    enableNativeCrashHandling: enableNative,
    enableNdk: enableNative,
    enableNdkScopeSync: enableNative,
    enableAppHangTracking: enableNative,
    enableWatchdogTerminationTracking: enableNative,
    enableAutoPerformanceTracing: false,
    enableAppStartTracking: false,
    enableNativeFramesTracking: false,
    enableStallTracking: false,
    enableUserInteractionTracing: false,
    tracesSampleRate: 0,
    tracePropagationTargets: [],
    profilesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeBreadcrumb: sanitizeBreadcrumb,
    beforeSend: sanitizeEvent,
  });

  sentryInitialized = true;
}

export function withSentryRoot<P extends Record<string, unknown>>(
  component: ComponentType<P>,
): ComponentType<P> {
  return Sentry.wrap(component);
}

function sanitizeEvent(event: ErrorEvent): ErrorEvent {
  const sanitizedEvent: ErrorEvent = {
    ...event,
    message: sanitizeOptionalText(event.message),
    logentry: event.logentry
      ? {
          ...event.logentry,
          message: sanitizeOptionalText(event.logentry.message),
          params: event.logentry.params?.map((param) =>
            sanitizeValue(param, undefined, new WeakSet()),
          ),
        }
      : event.logentry,
    exception: event.exception
      ? {
          ...event.exception,
          values: event.exception.values?.map(sanitizeException),
        }
      : event.exception,
    breadcrumbs: event.breadcrumbs?.map(sanitizeBreadcrumb),
    contexts: sanitizeRecord(event.contexts),
    extra: sanitizeRecord(event.extra),
    tags: sanitizeRecord(event.tags),
  };

  delete sanitizedEvent.request;
  delete sanitizedEvent.user;

  return sanitizedEvent;
}

function sanitizeException(exception: Exception): Exception {
  return {
    ...exception,
    value: sanitizeOptionalText(exception.value),
  };
}

function sanitizeBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  return {
    ...breadcrumb,
    message: sanitizeOptionalText(breadcrumb.message),
    data: sanitizeRecord(breadcrumb.data),
  };
}

function sanitizeRecord<T extends Record<string, unknown> | undefined>(
  record: T,
): T {
  if (!record) {
    return record;
  }

  return sanitizeValue(record, undefined, new WeakSet()) as T;
}

function sanitizeValue(
  value: unknown,
  key: string | undefined,
  seen: WeakSet<object>,
): unknown {
  if (key && SENSITIVE_FIELD_NAME_PATTERN.test(key)) {
    return "[Filtered]";
  }

  if (typeof value === "string") {
    return sanitizeText(value);
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, undefined, seen));
  }

  const record = value as Record<string, unknown>;

  return Object.fromEntries(
    Object.entries(record).map(([recordKey, recordValue]) => [
      recordKey,
      sanitizeValue(recordValue, recordKey, seen),
    ]),
  );
}

function sanitizeOptionalText(value: string | undefined): string | undefined {
  return value ? sanitizeText(value) : value;
}

function sanitizeText(value: string): string {
  return value.replace(OTP_AUTH_URI_PATTERN, "otpauth://[Filtered]");
}
