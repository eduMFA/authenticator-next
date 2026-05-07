import { base32, base64 } from "@scure/base";

export const stripPemArmor = (pem: string): string => {
  return pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
};

export const base64ToBase32 = (base64Input: string): string => {
  return base32.encode(base64.decode(base64Input));
};
