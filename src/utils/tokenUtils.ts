import { EDUMFA_PROTOCOL, OTP_PROTOCOL } from "@/consts";
import {
  InvalidUrlError,
  OtpProtocolError,
  UnsupportedVersionError,
} from "@/errors/tokenErrors";
import { PushToken, PushTokenRolloutState } from "@/types";

const parseTokenV1 = (url: URL) => {
  const pushToken: Partial<PushToken> = {};

  const imageParam = url.searchParams.get("imageUri");
  if (imageParam != null) {
    try {
      pushToken["imageUrl"] = new URL(imageParam).toString();
    } catch {
      throw new InvalidUrlError("The provided image URL is invalid.");
    }
  }
  const { label, issuer } = parseLabelAndIssuer(url);
  pushToken["label"] = label;
  pushToken["issuer"] = issuer;

  const serialParam = url.searchParams.get("serial");
  if (!serialParam) {
    throw new InvalidUrlError("No serial parameter provided.");
  }
  pushToken["id"] = serialParam;

  const callbackUrlParam = url.searchParams.get("url");
  if (!callbackUrlParam) {
    throw new InvalidUrlError("No callback URL parameter provided.");
  }
  try {
    pushToken["callbackUrl"] = new URL(callbackUrlParam).toString();
  } catch {
    throw new InvalidUrlError("The provided callback URL is invalid.");
  }

  const ttlParam = url.searchParams.get("ttl");
  try {
    pushToken["ttl"] = ttlParam ? parseInt(ttlParam) : 10;
  } catch {
    throw new InvalidUrlError(`Invalid ttl: ${ttlParam}`);
  }

  const enrollmentCredentialParam = url.searchParams.get(
    "enrollment_credential",
  );
  if (!enrollmentCredentialParam) {
    throw new InvalidUrlError("No enrollment_credential parameter provided.");
  }
  pushToken["enrollmentCredential"] = enrollmentCredentialParam;

  const sslVerifyParam = url.searchParams.get("sslverify");
  pushToken["sslVerify"] = sslVerifyParam ? sslVerifyParam === "1" : true;

  const pinParam = url.searchParams.get("pin");
  if (pinParam === "True") {
    pushToken["pin"] = true;
  }

  return pushToken;
};

const parseTokenV2 = (url: URL) => {
  const pushToken: Partial<PushToken> = {};

  const serialParam = url.searchParams.get("serial");
  if (!serialParam) {
    throw new InvalidUrlError("No serial parameter provided.");
  }
  pushToken["id"] = serialParam;

  const label = decodeURIComponent(url.pathname.substring(1));
  if (!label) {
    throw new InvalidUrlError("No label provided in the URL path.");
  }
  pushToken["label"] = label;

  // TODO: Finish v2 implementation when v2 is specified

  return pushToken;
};

export const getTokenVersionParseFunction = {
  1: parseTokenV1,
  2: parseTokenV2,
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
  } as PushToken;
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

export const stripPemArmor = (pem: string): string => {
  return pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
};
