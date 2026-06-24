import {
  PushTokenRefreshErrorType,
  PushTokenRolloutState,
  type PushToken,
} from "@/types/token";
import type {
  EditableTokenFields,
  RefreshErrorDetails,
  RolloutFailureDetails,
} from "@/types/token-detail";
import { type MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";

type RefreshErrorMessages = {
  defaultMessage: string;
  networkMessage: string;
};

export const refreshErrorMessages = {
  defaultMessage: msg`This token could not be refreshed. It may have been removed on the server or the institution hosting the push service may be having a technical issue.`,
  networkMessage: msg`This token could not be refreshed because the push service could not be reached. Check your connection or try again later.`,
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

export function getRolloutFailureDetails(
  state: PushTokenRolloutState,
): RolloutFailureDetails {
  switch (state) {
    case PushTokenRolloutState.RSAKeyGenerationFailed:
      return {
        description: msg`The device could not create the RSA key pair required for this token. Retry rollout and keep the app open while it runs.`,
        title: msg`Key generation failed`,
      };
    case PushTokenRolloutState.SendRSAPublicKeyFailed:
      return {
        description: msg`This token could not be registered with the enrollment server. Check your connection or try again later.`,
        title: msg`Server registration failed`,
      };
    case PushTokenRolloutState.ParsingResponseFailed:
      return {
        description: msg`The server response could not be parsed or did not include the expected token material.`,
        title: msg`Enrollment response failed`,
      };
    default:
      return {
        description: msg`This token did not finish enrollment and cannot receive push requests until rollout succeeds.`,
        title: msg`Rollout Failed`,
      };
  }
}

export function getRolloutStateLabel(
  state: PushTokenRolloutState,
): MessageDescriptor {
  switch (state) {
    case PushTokenRolloutState.Pending:
      return msg`Pending`;
    case PushTokenRolloutState.RSAKeyGeneration:
      return msg`Generating keys`;
    case PushTokenRolloutState.RSAKeyGenerationFailed:
      return msg`Key generation failed`;
    case PushTokenRolloutState.SendRSAPublicKey:
      return msg`Registering public key`;
    case PushTokenRolloutState.SendRSAPublicKeyFailed:
      return msg`Registration failed`;
    case PushTokenRolloutState.ParsingResponse:
      return msg`Finalizing enrollment`;
    case PushTokenRolloutState.ParsingResponseFailed:
      return msg`Response parsing failed`;
    case PushTokenRolloutState.Completed:
      return msg`Enrolled`;
  }
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
  errorType: PushTokenRefreshErrorType | undefined,
  messages: RefreshErrorMessages,
): RefreshErrorDetails {
  if (errorType === PushTokenRefreshErrorType.Network) {
    return { message: messages.networkMessage };
  }

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

  return { message: messages.defaultMessage, serverMessage: error };
}
