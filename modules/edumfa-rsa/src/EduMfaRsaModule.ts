import { requireNativeModule } from "expo";

import type { RsaPublicKey, RsaSignatureAlgorithm } from "./EduMfaRsa.types";

declare class EduMfaRsaModule {
  readonly SHA256: RsaSignatureAlgorithm;
  readonly SHA512: RsaSignatureAlgorithm;
  readonly SHA1: RsaSignatureAlgorithm;

  generateKeyPair(keyAlias: string, keySize: number): Promise<RsaPublicKey>;
  getPublicKey(keyAlias: string): Promise<RsaPublicKey>;
  sign(
    message: string,
    keyAlias: string,
    algorithm: RsaSignatureAlgorithm,
  ): Promise<string>;
  verify(
    message: string,
    signatureBase64: string,
    publicKey: string,
    algorithm: RsaSignatureAlgorithm,
  ): Promise<boolean>;
  deleteKeyPair(keyAlias: string): Promise<boolean>;
}

export default requireNativeModule<EduMfaRsaModule>("EduMfaRsa");
