import {
  buildPushRequestSignedData,
  validatePushRequestData,
} from "@/utils/push-request";
import { request } from "./fixtures";

test("signs all choices in their displayed order", () => {
  expect(
    buildPushRequestSignedData({
      ...request,
      challenge_type: "number" as const,
      challenge_choices: "17,42,86",
    }),
  ).toBe(`nonce|${request.url}|serial|Sign in?|Login|1|number|17,42,86`);
});

test.each([
  "17,17,42",
  "1,42,86",
  "17,42",
  "17,42,86,99",
  "17|42|86",
  "00,42,86",
  "",
  null,
  [17, 42, 86],
])("rejects malformed number choices: %j", (challenge_choices) => {
  expect(
    validatePushRequestData({
      ...request,
      challenge_type: "number",
      challenge_choices,
    }),
  ).toBe(false);
});

test("accepts both legacy and numbered payloads", () => {
  expect(validatePushRequestData(request)).toBe(true);
  expect(
    validatePushRequestData({
      ...request,
      challenge_type: "number" as const,
      challenge_choices: "17,42,86",
    }),
  ).toBe(true);
});

test.each([
  { challenge_type: "future", challenge_choices: "17,42,86" },
  { challenge_type: "number" },
  { challenge_choices: "17,42,86" },
])("rejects unsupported or incomplete challenge metadata: %j", (challenge) => {
  expect(validatePushRequestData({ ...request, ...challenge })).toBe(false);
});
