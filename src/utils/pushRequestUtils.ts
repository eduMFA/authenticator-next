type PushRequestSignaturePayload = {
  nonce: string;
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
  return `${payload.nonce}|${payload.url}|${payload.serial}|${payload.title}|${normalizeSslVerify(payload.sslverify)}`;
}
