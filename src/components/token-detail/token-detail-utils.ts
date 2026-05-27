import { PushToken, PushTokenRolloutState } from "@/types";

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

export function getRolloutFailureDetails(state: PushTokenRolloutState) {
  switch (state) {
    case PushTokenRolloutState.RSAKeyGenerationFailed:
      return {
        description:
          "The device could not create the RSA key pair required for this token. Retry rollout and keep the app open while it runs.",
        title: "Key generation failed",
      };
    case PushTokenRolloutState.SendRSAPublicKeyFailed:
      return {
        description:
          "The public key could not be sent to the enrollment server. Check connectivity and the token callback URL before retrying.",
        title: "Server registration failed",
      };
    case PushTokenRolloutState.ParsingResponseFailed:
      return {
        description:
          "The server response could not be parsed or did not include the expected token material.",
        title: "Enrollment response failed",
      };
    default:
      return {
        description:
          "This token did not finish enrollment and cannot receive push requests until rollout succeeds.",
        title: "Rollout failed",
      };
  }
}

export function getRolloutStateLabel(state: PushTokenRolloutState) {
  switch (state) {
    case PushTokenRolloutState.Pending:
      return "Pending";
    case PushTokenRolloutState.RSAKeyGeneration:
      return "Generating keys";
    case PushTokenRolloutState.RSAKeyGenerationFailed:
      return "Key generation failed";
    case PushTokenRolloutState.SendRSAPublicKey:
      return "Registering public key";
    case PushTokenRolloutState.SendRSAPublicKeyFailed:
      return "Registration failed";
    case PushTokenRolloutState.ParsingResponse:
      return "Finalizing enrollment";
    case PushTokenRolloutState.ParsingResponseFailed:
      return "Response parsing failed";
    case PushTokenRolloutState.Completed:
      return "Enrolled";
  }
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
): RefreshErrorDetails {
  const defaultMessage =
    "This token could not be refreshed. It may have been removed on the server, your connection may be unavailable, or the institution hosting the push service may be having a technical issue.";

  if (!error) {
    return { message: defaultMessage };
  }

  const serverError = error.match(/^Server returned (\d+):\s*(.*)$/s);
  if (serverError) {
    const [, , responseBody] = serverError;
    const trimmedBody = responseBody.trim();

    if (!trimmedBody) {
      return { message: defaultMessage };
    }

    try {
      const parsedBody: unknown = JSON.parse(trimmedBody);
      const serverMessage =
        getNestedStringProperty(parsedBody, ["result", "message"]) ??
        getStringProperty(parsedBody, "message") ??
        getStringProperty(parsedBody, "detail") ??
        getStringProperty(parsedBody, "error");

      return { message: defaultMessage, serverMessage };
    } catch {
      return { message: defaultMessage, serverMessage: trimmedBody };
    }
  }

  if (error === "Network request failed") {
    return {
      message:
        "This token could not be refreshed because the network request failed. Check your connection and try again.",
    };
  }

  return { message: defaultMessage, serverMessage: error };
}
