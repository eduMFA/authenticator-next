import { buildPushRequestSignedData } from "@/utils/pushRequestUtils";

const payload = {
  nonce: "nonce-1",
  serial: "PUSH0001",
  title: "Login request",
  url: "https://mfa.example.com/validate",
};

describe("push request utilities", () => {
  test.each([
    [true, 1],
    [false, 0],
    ["1", 1],
    ["0", 0],
  ] as const)("normalizes sslverify value %p", (sslverify, expected) => {
    expect(buildPushRequestSignedData({ ...payload, sslverify })).toBe(
      `nonce-1|https://mfa.example.com/validate|PUSH0001|Login request|${expected}`,
    );
  });
});
