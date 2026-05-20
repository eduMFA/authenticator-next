import {
  InvalidUrlError,
  OtpProtocolError,
  UnsupportedVersionError,
} from "@/errors/tokenErrors";
import { PushTokenRolloutState } from "@/types";
import {
  isTokenEnrollmentUri,
  parseLabelAndIssuer,
  parseTokenFromUri,
  parseTokenResponse,
} from "@/utils/tokenUtils";

const createTokenUri = (params: Record<string, string>) => {
  const searchParams = new URLSearchParams({
    v: "1",
    serial: "PUSH0001",
    url: "https://mfa.example.com/validate/check",
    enrollment_credential: "enrollment-secret",
    ...params,
  });

  return `edumfa-push:/EduMFA:alice%40example.com?${searchParams.toString()}`;
};

describe("token utilities", () => {
  test("identifies supported eduMFA enrollment URLs", () => {
    expect(isTokenEnrollmentUri(createTokenUri({}))).toBe(true);
    expect(isTokenEnrollmentUri("otpauth:/totp/EduMFA:alice")).toBe(false);
    expect(isTokenEnrollmentUri("not a url")).toBe(false);
  });

  test("parses a v1 token enrollment URL", () => {
    const token = parseTokenFromUri(
      createTokenUri({
        imageUri: "https://mfa.example.com/logo.png",
        ttl: "30",
        sslverify: "0",
        pin: "True",
      }),
    );

    expect(token).toMatchObject({
      callbackUrl: "https://mfa.example.com/validate/check",
      enrollmentCredential: "enrollment-secret",
      id: "PUSH0001",
      imageUrl: "https://mfa.example.com/logo.png",
      issuer: "EduMFA",
      label: "alice@example.com",
      pin: true,
      rolloutState: PushTokenRolloutState.Pending,
      sslVerify: false,
      ttl: 30,
      version: 1,
    });
  });

  test("uses issuer query parameter when the path does not include one", () => {
    const { issuer, label } = parseLabelAndIssuer(
      new URL("edumfa-push:/alice%40example.com?issuer=EduMFA"),
    );

    expect({ issuer, label }).toEqual({
      issuer: "EduMFA",
      label: "alice@example.com",
    });
  });

  test("rejects invalid enrollment URLs", () => {
    expect(() => parseTokenFromUri("not a url")).toThrow(InvalidUrlError);
    expect(() => parseTokenFromUri("otpauth:/totp/EduMFA:alice")).toThrow(
      OtpProtocolError,
    );
    expect(() =>
      parseTokenFromUri(createTokenUri({ v: "99" })),
    ).toThrow(UnsupportedVersionError);
    expect(() =>
      parseTokenFromUri(createTokenUri({ url: "not-a-url" })),
    ).toThrow(InvalidUrlError);
  });

  test("normalizes token rollout response public keys", async () => {
    const response = {
      json: jest.fn().mockResolvedValue({
        detail: {
          public_key: "-----BEGIN PUBLIC KEY-----\nabc123\n-----END PUBLIC KEY-----",
        },
      }),
    } as unknown as Response;

    await expect(parseTokenResponse(response)).resolves.toBe(
      "-----BEGIN PUBLIC KEY-----abc123-----END PUBLIC KEY-----",
    );
  });
});
