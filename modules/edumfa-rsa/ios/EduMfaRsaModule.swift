import ExpoModulesCore
import Foundation
import Security

private enum EduMfaRsaError: Error, LocalizedError {
  case emptyAlias
  case invalidKeySize(Int)
  case keyGenerationFailed(String)
  case keyNotFound(String)
  case publicKeyExportFailed
  case invalidPublicKey
  case invalidSignature
  case unsupportedAlgorithm(String)
  case signingFailed(String)
  case keychainDeleteFailed(OSStatus)

  var errorDescription: String? {
    switch self {
    case .emptyAlias:
      return "Key alias must not be empty."
    case .invalidKeySize(let keySize):
      return "Invalid RSA key size: \(keySize)."
    case .keyGenerationFailed(let reason):
      return "RSA key generation failed: \(reason)"
    case .keyNotFound(let keyAlias):
      return "No RSA private key found for alias '\(keyAlias)'."
    case .publicKeyExportFailed:
      return "Could not export the RSA public key."
    case .invalidPublicKey:
      return "The RSA public key is not valid."
    case .invalidSignature:
      return "The RSA signature is not valid base64."
    case .unsupportedAlgorithm(let algorithm):
      return "Unsupported RSA signature algorithm: \(algorithm)."
    case .signingFailed(let reason):
      return "RSA signing failed: \(reason)"
    case .keychainDeleteFailed(let status):
      return "Could not delete RSA keychain item. OSStatus: \(status)."
    }
  }
}

private struct Asn1Reader {
  private let bytes: [UInt8]
  private var offset = 0

  init(_ data: Data) {
    self.bytes = Array(data)
  }

  init(_ bytes: [UInt8]) {
    self.bytes = bytes
  }

  mutating func peekTag() throws -> UInt8 {
    guard offset < bytes.count else {
      throw EduMfaRsaError.invalidPublicKey
    }
    return bytes[offset]
  }

  mutating func readElement(expectedTag: UInt8) throws -> [UInt8] {
    guard offset < bytes.count else {
      throw EduMfaRsaError.invalidPublicKey
    }

    let tag = bytes[offset]
    offset += 1
    guard tag == expectedTag else {
      throw EduMfaRsaError.invalidPublicKey
    }

    let length = try readLength()
    guard offset + length <= bytes.count else {
      throw EduMfaRsaError.invalidPublicKey
    }

    let content = Array(bytes[offset..<(offset + length)])
    offset += length
    return content
  }

  private mutating func readLength() throws -> Int {
    guard offset < bytes.count else {
      throw EduMfaRsaError.invalidPublicKey
    }

    let first = bytes[offset]
    offset += 1

    if first & 0x80 == 0 {
      return Int(first)
    }

    let lengthByteCount = Int(first & 0x7f)
    guard lengthByteCount > 0, lengthByteCount <= 4, offset + lengthByteCount <= bytes.count else {
      throw EduMfaRsaError.invalidPublicKey
    }

    var length = 0
    for _ in 0..<lengthByteCount {
      length = (length << 8) | Int(bytes[offset])
      offset += 1
    }
    return length
  }
}

public class EduMfaRsaModule: Module {
  public func definition() -> ModuleDefinition {
    Name("EduMfaRsa")

    Constant("SHA256") { "SHA256" }
    Constant("SHA512") { "SHA512" }
    Constant("SHA1") { "SHA1" }

    AsyncFunction("generateKeyPair") { (keyAlias: String, keySize: Int) -> [String: String] in
      let publicKey = try self.generateKeyPair(keyAlias: keyAlias, keySize: keySize)
      return ["publicKey": publicKey]
    }

    AsyncFunction("getPublicKey") { (keyAlias: String) -> [String: String] in
      let publicKey = try self.getPublicKeyPem(keyAlias: keyAlias)
      return ["publicKey": publicKey]
    }

    AsyncFunction("sign") { (message: String, keyAlias: String, algorithm: String) -> String in
      return try self.sign(message: message, keyAlias: keyAlias, algorithm: algorithm)
    }

    AsyncFunction("verify") { (message: String, signatureBase64: String, publicKey: String, algorithm: String) -> Bool in
      return try self.verify(message: message, signatureBase64: signatureBase64, publicKey: publicKey, algorithm: algorithm)
    }

    AsyncFunction("deleteKeyPair") { (keyAlias: String) -> Bool in
      return try self.deleteKeyPair(keyAlias: keyAlias)
    }
  }

  private func generateKeyPair(keyAlias: String, keySize: Int) throws -> String {
    try validate(keyAlias: keyAlias, keySize: keySize)
    try deleteKeychainTag(privateKeyTag(for: keyAlias), allowNotFound: true)
    try deleteKeychainTag(publicKeyTag(for: keyAlias), allowNotFound: true)

    let attributes: [String: Any] = [
      String(kSecAttrKeyType): kSecAttrKeyTypeRSA,
      String(kSecAttrKeySizeInBits): keySize,
      String(kSecPrivateKeyAttrs): [
        String(kSecAttrIsPermanent): true,
        String(kSecAttrApplicationTag): privateKeyTag(for: keyAlias),
        String(kSecAttrAccessible): kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
      ]
    ]

    var error: Unmanaged<CFError>?
    guard let privateKey = SecKeyCreateRandomKey(attributes as CFDictionary, &error) else {
      let reason = error?.takeRetainedValue().localizedDescription ?? "unknown error"
      throw EduMfaRsaError.keyGenerationFailed(reason)
    }

    guard let publicKey = SecKeyCopyPublicKey(privateKey) else {
      throw EduMfaRsaError.publicKeyExportFailed
    }

    return try publicKeyPem(from: publicKey)
  }

  private func getPublicKeyPem(keyAlias: String) throws -> String {
    try validate(keyAlias: keyAlias)
    let privateKey = try getPrivateKey(keyAlias: keyAlias)
    guard let publicKey = SecKeyCopyPublicKey(privateKey) else {
      throw EduMfaRsaError.publicKeyExportFailed
    }
    return try publicKeyPem(from: publicKey)
  }

  private func sign(message: String, keyAlias: String, algorithm: String) throws -> String {
    try validate(keyAlias: keyAlias)
    let privateKey = try getPrivateKey(keyAlias: keyAlias)
    let secAlgorithm = try signatureAlgorithm(algorithm)

    guard SecKeyIsAlgorithmSupported(privateKey, .sign, secAlgorithm) else {
      throw EduMfaRsaError.unsupportedAlgorithm(algorithm)
    }

    let messageData = Data(message.utf8)
    var error: Unmanaged<CFError>?
    guard let signature = SecKeyCreateSignature(privateKey, secAlgorithm, messageData as CFData, &error) as Data? else {
      let reason = error?.takeRetainedValue().localizedDescription ?? "unknown error"
      throw EduMfaRsaError.signingFailed(reason)
    }

    return signature.base64EncodedString()
  }

  private func verify(message: String, signatureBase64: String, publicKey: String, algorithm: String) throws -> Bool {
    let key = try createPublicKey(from: publicKey)
    let secAlgorithm = try signatureAlgorithm(algorithm)

    guard SecKeyIsAlgorithmSupported(key, .verify, secAlgorithm) else {
      throw EduMfaRsaError.unsupportedAlgorithm(algorithm)
    }

    guard let signature = Data(base64Encoded: signatureBase64, options: .ignoreUnknownCharacters) else {
      throw EduMfaRsaError.invalidSignature
    }

    let messageData = Data(message.utf8)
    var error: Unmanaged<CFError>?
    let isValid = SecKeyVerifySignature(key, secAlgorithm, messageData as CFData, signature as CFData, &error)
    if !isValid {
      _ = error?.takeRetainedValue()
    }
    return isValid
  }

  private func deleteKeyPair(keyAlias: String) throws -> Bool {
    try validate(keyAlias: keyAlias)
    try deleteKeychainTag(privateKeyTag(for: keyAlias), allowNotFound: true)
    try deleteKeychainTag(publicKeyTag(for: keyAlias), allowNotFound: true)
    return true
  }

  private func getPrivateKey(keyAlias: String) throws -> SecKey {
    let query: [String: Any] = [
      String(kSecClass): kSecClassKey,
      String(kSecAttrKeyType): kSecAttrKeyTypeRSA,
      String(kSecAttrKeyClass): kSecAttrKeyClassPrivate,
      String(kSecAttrApplicationTag): privateKeyTag(for: keyAlias),
      String(kSecReturnRef): true
    ]

    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)
    guard status == errSecSuccess, let privateKey = item else {
      throw EduMfaRsaError.keyNotFound(keyAlias)
    }
    return privateKey as! SecKey
  }

  private func deleteKeychainTag(_ tag: Data, allowNotFound: Bool) throws {
    let query: [String: Any] = [
      String(kSecClass): kSecClassKey,
      String(kSecAttrKeyType): kSecAttrKeyTypeRSA,
      String(kSecAttrApplicationTag): tag
    ]

    let status = SecItemDelete(query as CFDictionary)
    if status != errSecSuccess && !(allowNotFound && status == errSecItemNotFound) {
      throw EduMfaRsaError.keychainDeleteFailed(status)
    }
  }

  private func publicKeyPem(from publicKey: SecKey) throws -> String {
    var error: Unmanaged<CFError>?
    guard let pkcs1 = SecKeyCopyExternalRepresentation(publicKey, &error) as Data? else {
      _ = error?.takeRetainedValue()
      throw EduMfaRsaError.publicKeyExportFailed
    }

    let spki = wrapPkcs1PublicKeyInSubjectPublicKeyInfo(pkcs1)
    return pem(label: "PUBLIC KEY", data: spki)
  }

  private func createPublicKey(from publicKey: String) throws -> SecKey {
    let der = try decodePemBody(publicKey)
    let attributes: [String: Any] = [
      String(kSecAttrKeyType): kSecAttrKeyTypeRSA,
      String(kSecAttrKeyClass): kSecAttrKeyClassPublic
    ]

    var error: Unmanaged<CFError>?
    if let key = SecKeyCreateWithData(der as CFData, attributes as CFDictionary, &error) {
      return key
    }
    _ = error?.takeRetainedValue()

    let pkcs1 = pkcs1PublicKeyData(fromPossibleSubjectPublicKeyInfo: der)
    error = nil
    if let key = SecKeyCreateWithData(pkcs1 as CFData, attributes as CFDictionary, &error) {
      return key
    }
    _ = error?.takeRetainedValue()

    throw EduMfaRsaError.invalidPublicKey
  }

  private func decodePemBody(_ key: String) throws -> Data {
    var body = key
      .replacingOccurrences(of: "-----BEGIN [^-]+-----", with: "", options: .regularExpression)
      .replacingOccurrences(of: "-----END [^-]+-----", with: "", options: .regularExpression)
      .replacingOccurrences(of: "\\s", with: "", options: .regularExpression)
      .replacingOccurrences(of: "-", with: "+")
      .replacingOccurrences(of: "_", with: "/")

    let paddingLength = (4 - (body.count % 4)) % 4
    if paddingLength > 0 {
      body.append(String(repeating: "=", count: paddingLength))
    }

    guard let data = Data(base64Encoded: body, options: .ignoreUnknownCharacters) else {
      throw EduMfaRsaError.invalidPublicKey
    }
    return data
  }

  private func pkcs1PublicKeyData(fromPossibleSubjectPublicKeyInfo data: Data) -> Data {
    do {
      var reader = Asn1Reader(data)
      let outerContent = try reader.readElement(expectedTag: 0x30)
      var outer = Asn1Reader(outerContent)
      guard try outer.peekTag() == 0x30 else {
        return data
      }
      _ = try outer.readElement(expectedTag: 0x30)
      let bitString = try outer.readElement(expectedTag: 0x03)
      guard bitString.first == 0x00 else {
        return data
      }
      return Data(bitString.dropFirst())
    } catch {
      return data
    }
  }

  private func wrapPkcs1PublicKeyInSubjectPublicKeyInfo(_ pkcs1: Data) -> Data {
    let algorithmIdentifier: [UInt8] = [
      0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86,
      0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00
    ]
    let bitString = Data([UInt8(0x03)] + derLength(pkcs1.count + 1) + [UInt8(0x00)] + Array(pkcs1))
    var body = Data(algorithmIdentifier)
    body.append(bitString)
    return Data([UInt8(0x30)] + derLength(body.count) + Array(body))
  }

  private func derLength(_ length: Int) -> [UInt8] {
    if length < 128 {
      return [UInt8(length)]
    }

    var value = length
    var bytes: [UInt8] = []
    while value > 0 {
      bytes.insert(UInt8(value & 0xff), at: 0)
      value >>= 8
    }
    return [UInt8(0x80) | UInt8(bytes.count)] + bytes
  }

  private func pem(label: String, data: Data) -> String {
    let base64 = data.base64EncodedString()
    let lines = stride(from: 0, to: base64.count, by: 64).map { index -> String in
      let start = base64.index(base64.startIndex, offsetBy: index)
      let end = base64.index(start, offsetBy: min(64, base64.distance(from: start, to: base64.endIndex)))
      return String(base64[start..<end])
    }
    return "-----BEGIN \(label)-----\n\(lines.joined(separator: "\n"))\n-----END \(label)-----"
  }

  private func signatureAlgorithm(_ algorithm: String) throws -> SecKeyAlgorithm {
    switch algorithm {
    case "SHA256":
      return .rsaSignatureMessagePKCS1v15SHA256
    case "SHA512":
      return .rsaSignatureMessagePKCS1v15SHA512
    case "SHA1":
      return .rsaSignatureMessagePKCS1v15SHA1
    default:
      throw EduMfaRsaError.unsupportedAlgorithm(algorithm)
    }
  }

  private func validate(keyAlias: String, keySize: Int? = nil) throws {
    guard !keyAlias.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
      throw EduMfaRsaError.emptyAlias
    }

    if let keySize, keySize < 2048 || keySize % 1024 != 0 {
      throw EduMfaRsaError.invalidKeySize(keySize)
    }
  }

  private func privateKeyTag(for keyAlias: String) -> Data {
    Data("\(keyAlias).private".utf8)
  }

  private func publicKeyTag(for keyAlias: String) -> Data {
    Data("\(keyAlias).public".utf8)
  }
}
