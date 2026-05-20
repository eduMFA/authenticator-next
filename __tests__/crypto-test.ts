import {
  base32ToBase64,
  base64ToBase32,
  stripPemArmor,
} from "@/utils/crypto";

describe("crypto utilities", () => {
  test("strips PEM armor and whitespace", () => {
    expect(
      stripPemArmor(`
        -----BEGIN PUBLIC KEY-----
        abc
        123
        -----END PUBLIC KEY-----
      `),
    ).toBe("abc123");
  });

  test("converts signatures between base64 and base32", () => {
    const signatureBase64 = "YWJjMTIz";

    expect(base32ToBase64(base64ToBase32(signatureBase64))).toBe(
      signatureBase64,
    );
  });
});
