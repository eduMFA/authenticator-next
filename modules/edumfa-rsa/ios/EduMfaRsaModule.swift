import ExpoModulesCore

public class EduMfaRsaModule: Module {
  private let crypto = EduMfaRsaCrypto()

  public func definition() -> ModuleDefinition {
    Name("EduMfaRsa")

    Constant("SHA256") { "SHA256" }
    Constant("SHA512") { "SHA512" }
    Constant("SHA1") { "SHA1" }

    AsyncFunction("generateKeyPair") { (keyAlias: String, keySize: Int) -> [String: String] in
      let publicKey = try self.crypto.generateKeyPair(keyAlias: keyAlias, keySize: keySize)
      return ["publicKey": publicKey]
    }

    AsyncFunction("getPublicKey") { (keyAlias: String) -> [String: String] in
      let publicKey = try self.crypto.getPublicKeyPem(keyAlias: keyAlias)
      return ["publicKey": publicKey]
    }

    AsyncFunction("sign") { (message: String, keyAlias: String, algorithm: String) -> String in
      return try self.crypto.sign(message: message, keyAlias: keyAlias, algorithm: algorithm)
    }

    AsyncFunction("verify") { (message: String, signatureBase64: String, publicKey: String, algorithm: String) -> Bool in
      return try self.crypto.verify(message: message, signatureBase64: signatureBase64, publicKey: publicKey, algorithm: algorithm)
    }

    AsyncFunction("deleteKeyPair") { (keyAlias: String) -> Bool in
      return try self.crypto.deleteKeyPair(keyAlias: keyAlias)
    }
  }

}
