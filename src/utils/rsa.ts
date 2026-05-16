import EduMfaRsaModule, {
  type RsaPublicKey,
  type RsaSignatureAlgorithm,
} from "../../modules/edumfa-rsa";
import { SIGN_ALGORITHM } from "@/consts";

export type { RsaPublicKey, RsaSignatureAlgorithm };

export async function generateRsaKeyPair(
  keyAlias: string,
  keySize: number,
): Promise<RsaPublicKey> {
  return EduMfaRsaModule.generateKeyPair(keyAlias, keySize);
}

export async function getRsaPublicKey(keyAlias: string): Promise<RsaPublicKey> {
  return EduMfaRsaModule.getPublicKey(keyAlias);
}

export async function signMessage(
  message: string,
  keyAlias: string,
  algorithm: RsaSignatureAlgorithm = SIGN_ALGORITHM,
): Promise<string> {
  return EduMfaRsaModule.sign(message, keyAlias, algorithm);
}

export async function verifyMessage(
  message: string,
  signatureBase64: string,
  publicKey: string,
  algorithm: RsaSignatureAlgorithm = SIGN_ALGORITHM,
): Promise<boolean> {
  return EduMfaRsaModule.verify(message, signatureBase64, publicKey, algorithm);
}

export async function deleteRsaKeyPair(keyAlias: string): Promise<boolean> {
  return EduMfaRsaModule.deleteKeyPair(keyAlias);
}
