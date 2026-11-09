import { EDUMFA_PROTOCOL, OTP_PROTOCOL } from "@/constants/auth";
import { DEFAULT_TOKEN_TTL } from "@/constants/token";
import {
  InvalidUrlError,
  OtpProtocolError,
  UnsupportedVersionError,
} from "@/errors/token";
import type { PushToken } from "@/types/token";
import { PushTokenRolloutState } from "@/types/token";

const parseEnrollmentFields = (
  url: URL,
  credentialKey: "enrollment_credential" | "enrollmentCredential",
) => {

  const serialParam = url.searchParams.get("serial");
  if (!serialParam) {
    throw new InvalidUrlError("No serial parameter provided.");
  }
  const callbackUrlParam = url.searchParams.get("url");
  if (!callbackUrlParam) {
    throw new InvalidUrlError("No callback URL parameter provided.");
  }
  let callbackUrl: string;
  try {
    callbackUrl = new URL(callbackUrlParam).toString();
  } catch {
    throw new InvalidUrlError("The provided callback URL is invalid.");
  }

  const ttlParam = url.searchParams.get("ttl");
  const ttl = ttlParam === null ? DEFAULT_TOKEN_TTL : Number(ttlParam);
  if (!Number.isFinite(ttl) || ttl <= 0) {
    throw new InvalidUrlError(`Invalid ttl: ${ttlParam}`);
  }
  const enrollmentCredential = url.searchParams.get(credentialKey);
  if (!enrollmentCredential) {
    throw new InvalidUrlError(`No ${credentialKey} parameter provided.`);
  }

  return {
    id: serialParam,
    callbackUrl,
    ttl,
    enrollmentCredential,
    enrollmentStartedAt: Date.now(),
  };
};

const parseTokenV1 = (url: URL) => {
  const { label, issuer } = parseLabelAndIssuer(url);
  const sslVerifyParam = url.searchParams.get("sslverify");

  return {
    ...parseEnrollmentFields(url, "enrollment_credential"),
    label,
    issuer,
    sslVerify: sslVerifyParam ? sslVerifyParam === "1" : true,
    ...(url.searchParams.get("pin") === "True" && { pin: true }),
  };
};

const parseTokenV2 = (url: URL) => {
  const label = decodeURIComponent(url.pathname.substring(1));
  if (!label) {
    throw new InvalidUrlError("No label provided in the URL path.");
  }
  return {
    ...parseEnrollmentFields(url, "enrollmentCredential"),
    label,
    issuer: url.searchParams.get("issuer") || undefined,
    sslVerify: true,
    ...(url.searchParams.get("requireDeviceAuth") === "true" && {
      requireDeviceAuth: true,
    }),
  };
};

export const getTokenVersionParseFunction = {
  1: parseTokenV1,
  2: parseTokenV2,
};

export const isTokenEnrollmentUri = (uri: string): boolean => {
  try {
    const url = new URL(uri);
    if (url.protocol !== EDUMFA_PROTOCOL) {
      return false;
    }

    const versionParam = url.searchParams.get("v");
    const version = versionParam ? parseInt(versionParam, 10) : undefined;

    return (
      version !== undefined &&
      !Number.isNaN(version) &&
      version in getTokenVersionParseFunction
    );
  } catch {
    return false;
  }
};

export function parseTokenFromUri(uri: string): PushToken {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    throw new InvalidUrlError("The provided URL is invalid");
  }

  if (url.protocol === OTP_PROTOCOL) {
    throw new OtpProtocolError("The provided URL uses the OTP protocol.");
  }

  if (url.protocol !== EDUMFA_PROTOCOL) {
    throw new InvalidUrlError(
      "The provided URL does not use the eduMFA protocol.",
    );
  }

  const versionParam = url.searchParams.get("v");
  const version = versionParam ? parseInt(versionParam, 10) : undefined;

  if (
    version === undefined ||
    Number.isNaN(version) ||
    !(version in getTokenVersionParseFunction)
  ) {
    throw new UnsupportedVersionError(
      "The provided token version is not supported.",
    );
  }

  const parseFunction =
    getTokenVersionParseFunction[
      version as keyof typeof getTokenVersionParseFunction
    ];

  return {
    version,
    rolloutState: PushTokenRolloutState.Pending,
    ...parseFunction(url),
  };
}

export const parseLabelAndIssuer = (uri: URL) => {
  const path = decodeURIComponent(uri.pathname.substring(1));
  if (path.includes(":")) {
    const [issuer, label] = path.split(":");
    return { label, issuer };
  }
  return {
    label: path,
    issuer: parseIssuer(uri),
  };
};

export const parseIssuer = (uri: URL) => {
  const issuerParam = uri.searchParams.get("issuer");
  if (issuerParam) {
    return decodeURIComponent(issuerParam);
  }
  return undefined;
};

export const parseTokenResponse = async (response: Response) => {
  const data = await response.json();
  const key = data.detail.public_key.replaceAll("\n", "");
  return key;
};
