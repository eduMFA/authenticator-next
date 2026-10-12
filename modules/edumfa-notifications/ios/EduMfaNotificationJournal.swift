import Foundation
import Darwin
import Security

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
struct NotificationJournalEntry: Codable {
  var request: NotificationPushRequest
  var isNative: Bool
}

struct NotificationJournalState: Codable {
  var tokens: [NotificationToken] = []
  var entries: [String: NotificationJournalEntry] = [:]

  var pendingCount: Int {
    entries.values.filter { entry in
      entry.request.status == "pending" && !entry.request.isExpired &&
        tokens.contains { $0.id == entry.request.serial }
    }.count
  }
}

enum NotificationJournalError: Error {
  case unavailableAppGroup, lock(Int32)
}

// Each transaction reloads the file under a cross-process lock. An extension
// arrival and an app/Watch action must never save competing cached snapshots.
final class NotificationJournalStore {
  private let defaults: UserDefaults
  private let appGroup: String?
  private let directory: URL?
  private let localLock = NSLock()

  init(defaults: UserDefaults = .standard, appGroup: String? = nil, directory: URL? = nil) {
    self.defaults = defaults
    self.appGroup = appGroup
    self.directory = directory
  }

  func read() throws -> NotificationJournalState {
    try access(writing: false) { $0 }
  }

  func transaction<T>(_ operation: (inout NotificationJournalState) throws -> T) throws -> T {
    try access(writing: true, operation)
  }

  func recordArrival(
    _ request: NotificationPushRequest,
    verify: (NotificationPushRequest, NotificationToken) throws -> Bool
  ) throws -> Int? {
    try transaction { state in
      guard let token = state.tokens.first(where: { $0.id == request.serial }),
            try verify(request, token) else { return nil }
      // Redelivery must not reset expiry or resurrect an answered challenge.
      var entry = state.entries[request.key] ?? NotificationJournalEntry(request: request, isNative: true)
      entry.isNative = true
      state.entries[request.key] = entry
      let cutoff = Date().timeIntervalSince1970 * 1000 - 86_400_000
      state.entries = state.entries.filter { $0.value.request.sentAt > cutoff }
      return state.pendingCount
    }
  }

  private func access<T>(writing: Bool, _ operation: (inout NotificationJournalState) throws -> T) throws -> T {
    localLock.lock()
    defer { localLock.unlock() }
    var folder = directory
    if let appGroup {
      folder = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)
      guard folder != nil else { throw NotificationJournalError.unavailableAppGroup }
    }
    if let folder {
      try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
      let lockFile = folder.appendingPathComponent("notifications.lock")
      let descriptor = open(lockFile.path, O_CREAT | O_RDWR, 0o600)
      guard descriptor >= 0 else { throw NotificationJournalError.lock(errno) }
      defer { close(descriptor) }
      #if os(iOS)
      try FileManager.default.setAttributes(
        [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: lockFile.path
      )
      #endif
      guard flock(descriptor, LOCK_EX) == 0 else { throw NotificationJournalError.lock(errno) }
      defer { flock(descriptor, LOCK_UN) }
      let file = folder.appendingPathComponent("notifications.json")
      var state = try FileManager.default.fileExists(atPath: file.path)
        ? JSONDecoder().decode(NotificationJournalState.self, from: Data(contentsOf: file))
        : loadLegacyState()
      // The extension can create an empty file before the upgraded app first
      // opens. Still migrate the app's private journal when it becomes available.
      let legacy = loadLegacyState()
      if state.tokens.isEmpty { state.tokens = legacy.tokens }
      for entry in legacy.entries.values {
        let current = state.entries[entry.request.key]?.request
        if current == nil || (current?.status == "pending" && entry.request.isCompleted) {
          state.entries[entry.request.key] = entry
        }
      }
      let result = try operation(&state)
      if writing {
        var options: Data.WritingOptions = [.atomic]
        #if os(iOS)
        options.insert(.completeFileProtectionUntilFirstUserAuthentication)
        #endif
        try JSONEncoder().encode(state).write(to: file, options: options)
        removeLegacyState()
        defaults.removeObject(forKey: "eduMFA.notificationState")
      }
      return result
    }
    var state = try defaults.data(forKey: "eduMFA.notificationState").map {
      try JSONDecoder().decode(NotificationJournalState.self, from: $0)
    } ?? loadLegacyState()
    let result = try operation(&state)
    if writing {
      defaults.set(try JSONEncoder().encode(state), forKey: "eduMFA.notificationState")
      removeLegacyState()
    }
    return result
  }

  private func loadLegacyState() -> NotificationJournalState {
    if let data = defaults.data(forKey: "eduMFA.notificationState"),
       let state = try? JSONDecoder().decode(NotificationJournalState.self, from: data) { return state }
    var state = NotificationJournalState()
    if let data = defaults.data(forKey: "eduMFA.notificationJournal"),
       let saved = try? JSONDecoder().decode([NotificationJournalEntry].self, from: data) {
      for entry in saved { state.entries[entry.request.key] = entry }
    } else {
      for (key, native) in [("eduMFA.notificationRequests", false), ("eduMFA.notificationResults", true)] {
        guard let data = defaults.data(forKey: key),
              let saved = try? JSONDecoder().decode([NotificationPushRequest].self, from: data) else { continue }
        for request in saved {
          let current = state.entries[request.key]?.request
          let recovered = current.flatMap { $0.isCompleted ? $0 : nil } ?? request
          state.entries[request.key] = NotificationJournalEntry(request: recovered, isNative: native)
        }
      }
    }
    return state
  }

  private func removeLegacyState() {
    for key in ["eduMFA.notificationJournal", "eduMFA.notificationRequests", "eduMFA.notificationResults"] {
      defaults.removeObject(forKey: key)
    }
  }
}
