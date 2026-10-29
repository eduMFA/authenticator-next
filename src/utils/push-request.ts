import type { PushChallengeType, PushRequestData } from "@/types/push-request";

type PushRequestSignaturePayload = {
  challenge_type?: PushChallengeType;
  challenge_choices?: string;
  nonce: string;
  question: string;
  serial: string;
  sslverify: string | boolean;
  title: string;
  url: string;
};

function normalizeSslVerify(
  sslverify: PushRequestSignaturePayload["sslverify"],
) {
  if (typeof sslverify === "boolean") {
    return sslverify ? 1 : 0;
  }

  return sslverify === "1" ? 1 : 0;
}

export function buildPushRequestSignedData(
  payload: PushRequestSignaturePayload,
) {
  const challenge = payload.challenge_type
    ? `|${payload.challenge_type}|${payload.challenge_choices}`
    : "";
  return `${payload.nonce}|${payload.url}|${payload.serial}|${payload.question}|${payload.title}|${normalizeSslVerify(payload.sslverify)}${challenge}`;
}

/** FCM uses strings; require exactly three distinct two-digit numbers. */
export function isValidNumberChoices(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{2},\d{2},\d{2}$/.test(value) &&
    value.split(",").every((number) => Number(number) >= 10) &&
    new Set(value.split(",")).size === 3
  );
}

export function validatePushRequestData(
  data: unknown,
): data is PushRequestData {
  if (!data || typeof data !== "object") {
    return false;
  }

  const d = data as Record<string, unknown>;

  return (
    ((d.challenge_type === undefined && d.challenge_choices === undefined) ||
      (d.challenge_type === "number" &&
        isValidNumberChoices(d.challenge_choices))) &&
    typeof d.nonce === "string" &&
    typeof d.question === "string" &&
    typeof d.serial === "string" &&
    typeof d.signature === "string" &&
    typeof d.sslverify === "string" &&
    typeof d.title === "string" &&
    typeof d.url === "string"
  );
}
