import {
  isTokenEnrollmentUri,
  parseTokenFromUri,
  parseTokenResponse,
} from "@/utils/token";
import {
  InvalidUrlError,
  OtpProtocolError,
  UnsupportedVersionError,
} from "@/errors/token";
import { PushTokenRolloutState as State } from "@/types/token";
import { base32ToBase64, base64ToBase32, stripPemArmor } from "@/utils/crypto";
import { buildPushRequestSignedData } from "@/utils/push-request";
import { request, response } from "./fixtures";

function uri(params: Record<string, string> = {}, label = "Issuer:Account") {
  return `edumfa-push://token/${label}?${new URLSearchParams({ v: "1", serial: "serial", url: "https://example.org/push", enrollment_credential: "credential", ...params })}`;
}

describe("enrollment URI parsing", () => {
  test("parses defaults and issuer from path", () => {
    expect(parseTokenFromUri(uri())).toMatchObject({
      id: "serial",
      label: "Account",
      issuer: "Issuer",
      version: 1,
      sslVerify: true,
      rolloutState: State.Pending,
    });
  });
  test("parses optional settings and encoded label", () => {
    expect(
      parseTokenFromUri(
        uri(
          {
            ttl: "42",
            sslverify: "0",
            pin: "True",
            imageUri: "https://example.org/image",
            issuer: "School",
          },
          "Jane%20Doe",
        ),
      ),
    ).toMatchObject({
      label: "Jane Doe",
      issuer: "School",
      ttl: 42,
      sslVerify: false,
      pin: true,
    });
    expect(
      parseTokenFromUri(uri({ sslverify: "1", pin: "False" }, "Account")).pin,
    ).toBeUndefined();
    expect(parseTokenFromUri(uri({}, "Account")).issuer).toBeUndefined();
  });
  test.each(["1", "2"])("ignores QR image URLs for version %s", (v) => {
    for (const image of ["https://example.org/image.png", "invalid"]) {
      const parsed = parseTokenFromUri(uri({ v, imageUri: image, image }));
      expect(parsed.id).toBe("serial");
      expect(parsed).not.toHaveProperty("imageUrl");
    }
  });
  test.each(["serial", "url", "enrollment_credential"])(
    "rejects missing %s",
    (key) => {
      expect(() => parseTokenFromUri(uri({ [key]: "" }))).toThrow(
        InvalidUrlError,
      );
    },
  );
  test.each<Record<string, string>>([{ url: "invalid" }])(
    "rejects invalid nested URLs %p",
    (params) => {
      expect(() => parseTokenFromUri(uri(params))).toThrow(InvalidUrlError);
    },
  );
  test.each(["", "bad", "3"])("rejects unsupported version %s", (v) => {
    expect(() => parseTokenFromUri(uri({ v }))).toThrow(
      UnsupportedVersionError,
    );
  });
  test("rejects malformed URLs and other protocols", () => {
    expect(() => parseTokenFromUri("invalid")).toThrow(InvalidUrlError);
    expect(() => parseTokenFromUri("https://example.org")).toThrow(
      InvalidUrlError,
    );
    expect(() => parseTokenFromUri("otpauth://totp/account")).toThrow(
      OtpProtocolError,
    );
  });
  test("parses v2 labels and requires label and serial", () => {
    expect(parseTokenFromUri(uri({ v: "2" }, "Jane%20Doe"))).toMatchObject({
      label: "Jane Doe",
      version: 2,
    });
    expect(() => parseTokenFromUri(uri({ v: "2", serial: "" }))).toThrow(
      InvalidUrlError,
    );
    expect(() => parseTokenFromUri(uri({ v: "2" }, ""))).toThrow(
      InvalidUrlError,
    );
  });
  test.each([
    [uri(), true],
    [uri({ v: "2" }), true],
    [uri({ v: "" }), false],
    [uri({ v: "bad" }), false],
    [uri({ v: "3" }), false],
    ["invalid", false],
    ["https://example.org", false],
  ])("recognizes %s", (input, expected) => {
    expect(isTokenEnrollmentUri(input as string)).toBe(expected);
  });
  test("removes line breaks from server key and rejects missing key", async () => {
    await expect(
      parseTokenResponse(
        response(200, { detail: { public_key: "abc\ndef\n" } }),
      ),
    ).resolves.toEqual({ serverPublicKey: "abcdef" });
    await expect(parseTokenResponse(response())).rejects.toThrow();
  });
});

describe("signature encoding", () => {
  test.each([
    ["", ""],
    ["Zg==", "MY======"],
    ["Zm9v", "MZXW6==="],
  ])("converts known vector %s", (b64, b32) => {
    expect(base64ToBase32(b64)).toBe(b32);
    expect(base32ToBase64(b32)).toBe(b64);
  });
  test("rejects malformed encodings", () => {
    expect(() => base64ToBase32("!")).toThrow();
    expect(() => base32ToBase64("!")).toThrow();
  });
  test("strips PEM headers and whitespace", () => {
    expect(
      stripPemArmor(
        "-----BEGIN PUBLIC KEY-----\na b\r\nc\n-----END PUBLIC KEY-----",
      ),
    ).toBe("abc");
    expect(stripPemArmor("abc")).toBe("abc");
  });
  test.each([
    [true, 1],
    [false, 0],
    ["1", 1],
    ["0", 0],
    ["True", 0],
  ])("normalizes sslverify %s in signed data", (sslverify, expected) => {
    expect(buildPushRequestSignedData({ ...request, sslverify })).toBe(
      `nonce|https://example.org/push|serial|Sign in?|Login|${expected}`,
    );
  });
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
])("rollout state helpers for %s", (state) => {
  const failed = [
    State.RSAKeyGenerationFailed,
    State.SendRSAPublicKeyFailed,
    State.ParsingResponseFailed,
  ].includes(state);
  expect(State.isFailed(state)).toBe(failed);
  expect(State.isFinished(state)).toBe(failed || state === State.Completed);
  expect(State.needsRollout(state)).toBe(!failed && state !== State.Completed);
  expect(State.getProgress(state)).toBe(
    [0, 40, 100, 70, 100, 90, 100, 100][state],
  );
});
