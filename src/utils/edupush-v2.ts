import { SIGN_ALGORITHM } from "@/constants/auth";
import { base64ToBase32 } from "@/utils/crypto";
import { signMessage } from "@/utils/rsa";

export type EduPushV2Operation =
  | "respond_to_challenge"
  | "update_firebase_token"
  | "begin_upgrade"
  | "confirm_upgrade";

export async function signEduPushV2Operation(
  operation: EduPushV2Operation,
  serial: string,
  ...fields: (string | number | boolean)[]
): Promise<string> {
  const message = JSON.stringify([operation, serial, ...fields]);
  return base64ToBase32(await signMessage(message, serial, SIGN_ALGORITHM));
}
