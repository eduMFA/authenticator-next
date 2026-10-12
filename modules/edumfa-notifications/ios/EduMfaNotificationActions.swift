import Foundation
import Security
import EduMfaRsa

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
  private let store: NotificationJournalStore
  private let usesKeychain: Bool
  private let verify: Verify
  private let sign: Sign
  private let send: Send

  init(
    defaults: UserDefaults = .standard,
    usesKeychain: Bool = true,
    store: NotificationJournalStore? = nil,
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
    self.store = store ?? NotificationJournalStore(
      defaults: defaults,
      appGroup: usesKeychain ? Bundle.main.object(forInfoDictionaryKey: "EduMfaNotificationAppGroup") as? String : nil
    )
    self.usesKeychain = usesKeychain
    self.verify = verify
    self.sign = sign
    self.send = send
    if let state = try? self.store.read() {
      journal = state.entries
      tokens = state.tokens
    }
  }

  func synchronize(_ snapshot: NotificationSnapshot) throws -> [NotificationPushRequest] {
    try reload()
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
    try persist(tokens: snapshot.tokens)
    return actionResults()
  }

  func pendingRequests() -> [NotificationPushRequest] {
    try? reload()
    return journal.values.map(\.request).filter { request in
      request.status == "pending" && !request.isExpired && tokens.contains { $0.id == request.serial }
    }
  }

  func knownRequest(_ key: String) -> NotificationPushRequest? {
    try? reload()
    return journal[key]?.request
  }

  func badgeCount() throws -> Int { try store.read().pendingCount }

  func actionResults() -> [NotificationPushRequest] {
    try? reload()
    return journal.values.filter(\.isNative).map(\.request)
  }

  func recordDelivered(_ request: NotificationPushRequest) {
    guard (try? reload()) != nil else { return }
    guard journal[request.key] == nil, isTrusted(request) else { return }
    record(request)
    try? persist()
  }

  func expireRequests() {
    guard (try? reload()) != nil else { return }
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
      try reload()
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

  private func reload() throws {
    let state = try store.read()
    tokens = state.tokens
    journal = state.entries
  }

  private func persist(tokens enrolled: [NotificationToken]? = nil) throws {
    let saved = try store.transaction { state in
      let cutoff = Date().timeIntervalSince1970 * 1000 - 86_400_000
      for entry in state.entries.values where entry.isNative && entry.request.sentAt > cutoff {
        let cached = journal[entry.request.key]?.request
        if cached == nil || (cached?.status == "pending" && entry.request.status != "pending") {
          journal[entry.request.key] = entry
        }
      }
      state.entries = journal
      if let enrolled { state.tokens = enrolled }
      return state
    }
    journal = saved.entries
    tokens = saved.tokens
  }
}
