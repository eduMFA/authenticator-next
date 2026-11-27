import type { PushRequest, PushRequestData } from "@/types/push-request";
import type { PushToken } from "@/types/token";
import { i18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";

type PushRequestSignaturePayload = Omit<
  PushRequestData,
  "signature" | "sslverify"
> & {
  sslverify: string | boolean;
};

export function validatePushRequestData(
  data: unknown,
): data is PushRequestData {
  if (!data || typeof data !== "object") return false;
  const fields = data as Record<string, unknown>;
  return (
    typeof fields.nonce === "string" &&
    (fields.question === undefined || typeof fields.question === "string") &&
    typeof fields.serial === "string" &&
    typeof fields.signature === "string" &&
    typeof fields.sslverify === "string" &&
    typeof fields.title === "string" &&
    typeof fields.url === "string"
  );
}

export function getPushRequestBody({
  question,
}: Pick<PushRequestData, "question">): string {
  return question ?? i18n._(msg`Do you want to confirm the sign-in?`);
}

export function getPushNotificationContent(
  request: PushRequest,
  token?: Pick<PushToken, "label" | "imageUrl">,
) {
  const label = token?.label.trim();
  const title =
    label && label !== request.serial && label !== request.title
      ? [request.title, label].filter(Boolean).join(" · ")
      : request.title;
  const imageUrl = token?.imageUrl ? URL.parse(token.imageUrl) : null;
  return {
    title,
    body: getPushRequestBody(request),
    data: {
      ...request,
      pushRequestId: request.id,
      ...(imageUrl?.protocol === "https:" &&
        !imageUrl.username &&
        !imageUrl.password && {
          eduMfaTokenImageUrl: imageUrl.href,
        }),
    },
  };
}

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
  version?: number,
): string | null {
  const isV2 = version === 2;
  const { question } = payload;
  if (isV2 ? question !== undefined : question === undefined) return null;

  const prefix = `${payload.nonce}|${payload.url}|${payload.serial}|`;
  const signedQuestion = question === undefined ? "" : `${question}|`;
  return `${prefix}${signedQuestion}${payload.title}|${normalizeSslVerify(payload.sslverify)}`;
}
