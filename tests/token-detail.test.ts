import {
  formatTimestamp,
  getEditableTokenFields,
  getParamValue,
  getRolloutFailureDetails,
  getRolloutStateLabel,
  prettifyRefreshError,
} from "@/components/token-detail/token-detail-utils";
import {
  PushTokenRefreshErrorType as ErrorType,
  PushTokenRolloutState as State,
} from "@/types/token";
import { token } from "./fixtures";
const messages = {
  defaultMessage: "Refresh failed",
  networkMessage: "Check connection",
};

test("normalizes route parameters and editable fields", () => {
  expect(getParamValue("id")).toBe("id");
  expect(getParamValue(["first", "second"])).toBe("first");
  expect(getParamValue([])).toBeUndefined();
  expect(getParamValue(undefined)).toBeUndefined();
  expect(getEditableTokenFields(token)).toEqual({ label: "Account" });
});
test("formats valid timestamp and handles missing timestamps", () => {
  expect(formatTimestamp(undefined)).toBeNull();
  expect(formatTimestamp(0)).toBeNull();
  expect(formatTimestamp(1234567890000)).toBe(
    new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(1234567890000)),
  );
});
test.each([
  State.Pending,
  State.RSAKeyGeneration,
  State.RSAKeyGenerationFailed,
  State.SendRSAPublicKey,
  State.SendRSAPublicKeyFailed,
  State.ParsingResponse,
  State.ParsingResponseFailed,
  State.Completed,
])("provides rollout label for %s", (state) => {
  expect(getRolloutStateLabel(state).message).toBe(
    [
      "Pending",
      "Generating keys",
      "Key generation failed",
      "Registering public key",
      "Registration failed",
      "Finalizing enrollment",
      "Response parsing failed",
      "Enrolled",
    ][state],
  );
});
test.each([
  [State.RSAKeyGenerationFailed, "Key generation failed"],
  [State.SendRSAPublicKeyFailed, "Server registration failed"],
  [State.ParsingResponseFailed, "Enrollment response failed"],
  [State.Pending, "Rollout Failed"],
] as const)("explains failure %s", (state, title) => {
  expect(getRolloutFailureDetails(state).title.message).toBe(title);
  expect(getRolloutFailureDetails(state).description.message).toBeTruthy();
});
test("uses network and default messages", () => {
  expect(prettifyRefreshError("error", ErrorType.Network, messages)).toEqual({
    message: messages.networkMessage,
  });
  expect(prettifyRefreshError(undefined, undefined, messages)).toEqual({
    message: messages.defaultMessage,
  });
  expect(
    prettifyRefreshError("Server returned 500:   ", ErrorType.Server, messages),
  ).toEqual({ message: messages.defaultMessage });
  expect(
    prettifyRefreshError("local error", ErrorType.Unknown, messages),
  ).toEqual({ message: messages.defaultMessage, serverMessage: "local error" });
});
test.each([
  { result: { error: { message: "server" } } },
  { result: { message: "server" } },
  { error: { message: "server" } },
  { message: "server" },
  { detail: "server" },
  { error: "server" },
])("extracts server error from %p", (body) => {
  expect(
    prettifyRefreshError(
      `Server returned 400: ${JSON.stringify(body)}`,
      ErrorType.Server,
      messages,
    ),
  ).toEqual({ message: messages.defaultMessage, serverMessage: "server" });
});
test.each([
  {},
  null,
  1,
  { message: 1 },
  { result: null },
  { result: { error: { message: 1 } } },
])("handles server payload without textual message %p", (body) => {
  expect(
    prettifyRefreshError(
      `Server returned 400: ${JSON.stringify(body)}`,
      undefined,
      messages,
    ),
  ).toEqual({ message: messages.defaultMessage, serverMessage: undefined });
});
test("preserves plain text server response", () => {
  expect(
    prettifyRefreshError(
      "Server returned 503:  unavailable  ",
      ErrorType.Server,
      messages,
    ),
  ).toEqual({ message: messages.defaultMessage, serverMessage: "unavailable" });
});
