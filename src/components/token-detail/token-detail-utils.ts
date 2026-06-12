import { PushToken } from "@/types";

export type EditableTokenFields = {
  label: string;
};

export type RefreshErrorDetails = {
  message: string;
  serverMessage?: string;
};

export function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function getEditableTokenFields(token: PushToken): EditableTokenFields {
  return { label: token.label };
}

export function formatTimestamp(timestamp: number | undefined) {
  if (!timestamp) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function getStringProperty(value: unknown, key: string) {
  if (typeof value !== "object" || value === null || !(key in value)) {
    return undefined;
  }

  const property = value[key as keyof typeof value];
  return typeof property === "string" ? property : undefined;
}

function getNestedStringProperty(value: unknown, path: string[]) {
  let currentValue = value;

  for (const key of path) {
    if (
      typeof currentValue !== "object" ||
      currentValue === null ||
      !(key in currentValue)
    ) {
      return undefined;
    }

    currentValue = currentValue[key as keyof typeof currentValue];
  }

  return typeof currentValue === "string" ? currentValue : undefined;
}

export function prettifyRefreshError(
  error: string | undefined,
  messages: {
    defaultMessage: string;
    networkMessage: string;
  },
): RefreshErrorDetails {
  if (!error) {
    return { message: messages.defaultMessage };
  }

  const serverError = error.match(/^Server returned (\d+):\s*(.*)$/s);
  if (serverError) {
    const [, , responseBody] = serverError;
    const trimmedBody = responseBody.trim();

    if (!trimmedBody) {
      return { message: messages.defaultMessage };
    }

    try {
      const parsedBody: unknown = JSON.parse(trimmedBody);
      const serverMessage =
        getNestedStringProperty(parsedBody, ["result", "error", "message"]) ??
        getNestedStringProperty(parsedBody, ["result", "message"]) ??
        getNestedStringProperty(parsedBody, ["error", "message"]) ??
        getStringProperty(parsedBody, "message") ??
        getStringProperty(parsedBody, "detail") ??
        getStringProperty(parsedBody, "error");

      return { message: messages.defaultMessage, serverMessage };
    } catch {
      return { message: messages.defaultMessage, serverMessage: trimmedBody };
    }
  }

  if (error === "Network request failed") {
    return { message: messages.networkMessage };
  }

  return { message: messages.defaultMessage, serverMessage: error };
}
