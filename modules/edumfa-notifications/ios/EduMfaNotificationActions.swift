import Foundation
import Security
import EduMfaRsa

struct NotificationToken: Codable, Sendable {
  let id: String
  let callbackUrl: String
  let serverPublicKey: String
}

struct NotificationPushRequest: Codable, Sendable {
  let id: String
  var status: String
  var sentAt: Double
  let nonce: String
  let question: String
  let serial: String
  let signature: String
  let sslverify: String
  let title: String
  let url: String

  var key: String { serial + "\u{0}" + nonce }
  var isCompleted: Bool { status == "accepted" || status == "declined" }
  var isExpired: Bool { Date().timeIntervalSince1970 * 1000 - sentAt >= 120_000 }
  var signedData: String {
    "\(nonce)|\(url)|\(serial)|\(question)|\(title)|\(sslverify == "1" ? 1 : 0)"
  }

  static func from(userInfo: [AnyHashable: Any], identifier: String, date: Date) throws -> Self {
    var data = userInfo["body"] as? [String: Any] ?? userInfo.reduce(into: [String: Any]()) {
      if let key = $1.key as? String { $0[key] = $1.value }
    }
    data["id"] = identifier
    data["status"] = "pending"
    data["sentAt"] = date.timeIntervalSince1970 * 1000
    return try JSONDecoder().decode(Self.self, from: JSONSerialization.data(withJSONObject: data))
  }
}

enum NotificationActionError: Error {
  case invalidAction, invalidSignature, unknownToken, expired, invalidCallback, server(Int), keychain(OSStatus)
}

// RFC 4648, matching the backend's padded Base32 signatures.
enum NotificationBase32 {
  static let alphabet = Array("ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".utf8)

  static func decode(_ value: String) throws -> Data {
    let bytes = Array(value.utf8)
    guard !bytes.isEmpty, bytes.count % 8 == 0 else { throw NotificationActionError.invalidSignature }
    var accumulator = 0
    var bits = 0
    var output = Data()
    var padding = false
    for byte in bytes {
      if byte == 61 { padding = true; continue }
      guard !padding, let index = alphabet.firstIndex(of: byte) else {
        throw NotificationActionError.invalidSignature
      }
      accumulator = (accumulator << 5) | index
      bits += 5
      if bits >= 8 {
        bits -= 8
        output.append(UInt8((accumulator >> bits) & 255))
        accumulator &= (1 << bits) - 1
      }
    }
    guard encode(output) == value else { throw NotificationActionError.invalidSignature }
    return output
  }

  static func encode(_ value: Data) -> String {
    var accumulator = 0
    var bits = 0
    var output: [UInt8] = []
    for byte in value {
      accumulator = (accumulator << 8) | Int(byte)
      bits += 8
      while bits >= 5 {
        bits -= 5
        output.append(alphabet[(accumulator >> bits) & 31])
      }
      accumulator &= (1 << bits) - 1
    }
    if bits > 0 { output.append(alphabet[(accumulator << (5 - bits)) & 31]) }
    while output.count % 8 != 0 { output.append(61) }
    return String(decoding: output, as: UTF8.self)
  }
}

struct NotificationSnapshot: Codable {
  let tokens: [NotificationToken]
  let requests: [NotificationPushRequest]
}

// App snapshots may remove mirrored entries. Native entries are retained for
// recovery, including actions taken before JavaScript starts.
private struct NotificationJournalEntry: Codable {
  var request: NotificationPushRequest
  var isNative: Bool
}

enum NotificationTokenVault {
  private static var query: [String: Any] {
    [String(kSecClass): kSecClassGenericPassword,
     String(kSecAttrService): "io.edumfa.app.notification-tokens",
     String(kSecAttrAccount): "tokens"]
  }

  static func load() throws -> [NotificationToken] {
    var lookup = query
    lookup[String(kSecReturnData)] = true
    var item: CFTypeRef?
    let status = SecItemCopyMatching(lookup as CFDictionary, &item)
    if status == errSecItemNotFound { return [] }
    guard status == errSecSuccess, let data = item as? Data else {
      throw NotificationActionError.keychain(status)
    }
    return try JSONDecoder().decode([NotificationToken].self, from: data)
  }

  static func save(_ tokens: [NotificationToken]) throws {
    let data = try JSONEncoder().encode(tokens)
    let attributes: [String: Any] = [String(kSecValueData): data]
    var status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
    if status == errSecItemNotFound {
      var item = query
      item[String(kSecValueData)] = data
      item[String(kSecAttrAccessible)] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
      status = SecItemAdd(item as CFDictionary, nil)
    }
    guard status == errSecSuccess else { throw NotificationActionError.keychain(status) }
  }
}

actor EduMfaNotificationActions {
  static let shared = EduMfaNotificationActions()
  static let completedEvent = Notification.Name("eduMFA.notificationActionCompleted")

  typealias Verify = @Sendable (NotificationPushRequest, NotificationToken) throws -> Bool
  typealias Sign = @Sendable (String, String) throws -> String
  typealias Send = @Sendable (URLRequest) async throws -> Int

  private var tokens: [NotificationToken] = []
  private var journal: [String: NotificationJournalEntry] = [:]
  private var inFlight: [String: Task<Bool, Never>] = [:]
  private let defaults: UserDefaults
  private let usesKeychain: Bool
  private let verify: Verify
  private let sign: Sign
  private let send: Send

  init(
    defaults: UserDefaults = .standard,
    usesKeychain: Bool = true,
    verify: @escaping Verify = { request, token in
      try EduMfaRsaCrypto().verify(
        message: request.signedData,
        signatureBase64: NotificationBase32.decode(request.signature).base64EncodedString(),
        publicKey: token.serverPublicKey,
        algorithm: "SHA256"
      )
    },
    sign: @escaping Sign = { message, alias in
      try EduMfaRsaCrypto().sign(message: message, keyAlias: alias, algorithm: "SHA256")
    },
    send: @escaping Send = { request in
      let configuration = URLSessionConfiguration.ephemeral
      configuration.timeoutIntervalForRequest = 15
      configuration.timeoutIntervalForResource = 20
      let session = URLSession(configuration: configuration)
      defer { session.finishTasksAndInvalidate() }
      let (_, response) = try await session.data(for: request)
      return (response as? HTTPURLResponse)?.statusCode ?? 0
    }
  ) {
    self.defaults = defaults
    self.usesKeychain = usesKeychain
    self.verify = verify
    self.sign = sign
    self.send = send
    if let data = defaults.data(forKey: "eduMFA.notificationJournal"),
       let saved = try? JSONDecoder().decode([NotificationJournalEntry].self, from: data) {
      for entry in saved { journal[entry.request.key] = entry }
    } else {
      // Preserve requests and Watch outcomes from the previous two-store format.
      for (key, native) in [("eduMFA.notificationRequests", false), ("eduMFA.notificationResults", true)] {
        guard let data = defaults.data(forKey: key),
              let saved = try? JSONDecoder().decode([NotificationPushRequest].self, from: data) else { continue }
        for request in saved {
          var recovered = request
          if let current = journal[request.key]?.request, current.isCompleted {
            recovered = current
          }
          journal[request.key] = NotificationJournalEntry(
            request: recovered, isNative: native
          )
        }
      }
    }
  }

  func synchronize(_ snapshot: NotificationSnapshot) throws -> [NotificationPushRequest] {
    if usesKeychain { try NotificationTokenVault.save(snapshot.tokens) }
    tokens = snapshot.tokens
    var next = Dictionary(snapshot.requests.map {
      ($0.key, NotificationJournalEntry(request: $0, isNative: false))
    }, uniquingKeysWith: { first, _ in first })
    let cutoff = Date().timeIntervalSince1970 * 1000 - 86_400_000
    for var entry in journal.values where entry.isNative && entry.request.sentAt > cutoff {
      // Native completion wins a race with a stale app snapshot. For pending
      // outcomes, prefer the app's newer status while retaining recovery data.
      if entry.request.status == "pending", let current = next[entry.request.key] {
        entry.request = current.request
      }
      next[entry.request.key] = entry
    }
    journal = next
    try persist()
    return actionResults()
  }

  func pendingRequests() -> [NotificationPushRequest] {
    journal.values.map(\.request).filter { request in
      request.status == "pending" && !request.isExpired && tokens.contains { $0.id == request.serial }
    }
  }

  func knownRequest(_ key: String) -> NotificationPushRequest? { journal[key]?.request }

  func actionResults() -> [NotificationPushRequest] {
    journal.values.filter(\.isNative).map(\.request)
  }

  func recordDelivered(_ request: NotificationPushRequest) {
    guard journal[request.key] == nil, isTrusted(request) else { return }
    record(request)
    try? persist()
  }

  func expireRequests() {
    for var request in journal.values.map(\.request) where request.status == "pending" && request.isExpired {
      request.status = "expired"
      record(request)
    }
    try? persist()
  }

  func isTrusted(_ request: NotificationPushRequest) -> Bool {
    guard let token = tokens.first(where: { $0.id == request.serial }) else { return false }
    return (try? verify(request, token)) == true
  }

  func submit(_ request: NotificationPushRequest, action: String) async -> Bool {
    if let task = inFlight[request.key] { return await task.value }
    let task = Task { await self.perform(request, action: action) }
    inFlight[request.key] = task
    let success = await task.value
    inFlight.removeValue(forKey: request.key)
    return success
  }

  private func perform(_ incoming: NotificationPushRequest, action: String) async -> Bool {
    var request = incoming
    var trusted = false
    do {
      guard action == "ACCEPT" || action == "DECLINE" else { throw NotificationActionError.invalidAction }
      // Reload the secure snapshot on cold launches, before any JavaScript exists.
      if usesKeychain { tokens = try NotificationTokenVault.load() }
      guard let token = tokens.first(where: { $0.id == request.serial }) else {
        throw NotificationActionError.unknownToken
      }
      guard try verify(request, token) else { throw NotificationActionError.invalidSignature }
      trusted = true
      if let known = knownRequest(request.key) {
        if known.isCompleted { return true }
        request.sentAt = min(request.sentAt, known.sentAt)
      }
      request.status = "pending"
      record(request)
      guard !request.isExpired else {
        request.status = "expired"
        throw NotificationActionError.expired
      }
      guard let callback = URL(string: token.callbackUrl),
            ["https", "http"].contains(callback.scheme?.lowercased() ?? ""),
            callback.host != nil else { throw NotificationActionError.invalidCallback }
      let declined = action == "DECLINE"
      let message = "\(request.nonce)|\(request.serial)" + (declined ? "|decline" : "")
      let signature = try sign(message, request.serial)
      guard let signatureData = Data(base64Encoded: signature) else { throw NotificationActionError.invalidSignature }
      var submission = URLRequest(url: callback)
      submission.httpMethod = "POST"
      submission.setValue("application/json", forHTTPHeaderField: "Content-Type")
      submission.httpBody = try JSONSerialization.data(withJSONObject: [
        "nonce": request.nonce, "serial": request.serial,
        "signature": NotificationBase32.encode(signatureData), "decline": declined ? 1 : 0
      ])
      let status = try await send(submission)
      guard status == 200 else { throw NotificationActionError.server(status) }
      request.status = declined ? "declined" : "accepted"
      record(request)
      try persist()
      return true
    } catch {
      if trusted {
        // Keep verified failures available for the popup to retry on the next app launch.
        record(request)
        try? persist()
      }
      NSLog("[eduMFA] Notification action failed: %@", String(describing: error))
      return false
    }
  }

  private func record(_ request: NotificationPushRequest) {
    journal[request.key] = NotificationJournalEntry(request: request, isNative: true)
  }

  private func persist() throws {
    defaults.set(try JSONEncoder().encode(Array(journal.values)), forKey: "eduMFA.notificationJournal")
    defaults.removeObject(forKey: "eduMFA.notificationRequests")
    defaults.removeObject(forKey: "eduMFA.notificationResults")
  }
}
