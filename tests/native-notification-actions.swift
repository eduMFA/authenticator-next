// Run with the production crypto and action sources using scripts/test-ios-notification-actions.mjs.
import Foundation

enum TestFailure: Error { case assertion(String) }
func expect(_ value: Bool, _ message: String) throws {
  if !value { throw TestFailure.assertion(message) }
}

actor TestTransport {
  var requests: [URLRequest] = []
  var status = 200
  func respond(_ request: URLRequest) async throws -> Int {
    requests.append(request)
    try await Task.sleep(nanoseconds: 20_000_000)
    return status
  }
  func setStatus(_ value: Int) { status = value }
}

func sampleRequest(nonce: String = "nonce", age: Double = 0) -> NotificationPushRequest {
  NotificationPushRequest(
    id: nonce, status: "pending", sentAt: Date().timeIntervalSince1970 * 1000 - age,
    nonce: nonce, question: "Sign in?", serial: "serial", signature: "MY======",
    sslverify: "1", title: "Login", url: "https://payload.example/push"
  )
}

let suite = "eduMFA.notification-tests.\(UUID().uuidString)"
let defaults = UserDefaults(suiteName: suite)!
defer { defaults.removePersistentDomain(forName: suite) }
let tokens = [NotificationToken(id: "serial", callbackUrl: "https://registered.example/push", serverPublicKey: "key")]
let transport = TestTransport()
let actions = EduMfaNotificationActions(
  defaults: defaults, usesKeychain: false,
  verify: { request, _ in request.signature == "MY======" },
  sign: { message, _ in Data(message.utf8).base64EncodedString() },
  send: { try await transport.respond($0) }
)

// Independently generated OpenSSL RSA/SHA256 fixture, without a private key in the repo.
struct RsaFixture: Decodable { let key: String; let message: String; let signature: String }
let fixture = try JSONDecoder().decode(RsaFixture.self, from: Data(contentsOf:
  URL(fileURLWithPath: "tests/fixtures/notification-rsa-signature.json")
))
let crypto = EduMfaRsaCrypto()
try expect(try crypto.verify(message: fixture.message, signatureBase64: fixture.signature,
                             publicKey: fixture.key, algorithm: "SHA256"), "Valid RSA signature rejected")
try expect(!(try crypto.verify(message: fixture.message + "tampered", signatureBase64: fixture.signature,
                               publicKey: fixture.key, algorithm: "SHA256")), "Tampered challenge verified")

// Wire encoding must exactly match Python's base64.b32encode/decode.
for (plain, encoded) in [
  ("f", "MY======"), ("fo", "MZXQ===="), ("foo", "MZXW6==="),
  ("foob", "MZXW6YQ="), ("fooba", "MZXW6YTB"), ("foobar", "MZXW6YTBOI======")
] {
  try expect(NotificationBase32.encode(Data(plain.utf8)) == encoded, "Base32 encoding")
  try expect(try NotificationBase32.decode(encoded) == Data(plain.utf8), "Base32 decoding")
}
for malformed in ["", "MY", "MZ======", "MY=====A", "my======", "========"] {
  do {
    _ = try NotificationBase32.decode(malformed)
    throw TestFailure.assertion("Accepted malformed Base32: \(malformed)")
  } catch is NotificationActionError {}
}

let request = sampleRequest()
_ = try await actions.synchronize(NotificationSnapshot(tokens: tokens, requests: [request]))
try expect(request.signedData == "nonce|https://payload.example/push|serial|Sign in?|Login|1", "Signature field ordering")
// A Watch action and a popup submission share the same native in-flight task.
async let watch = actions.submit(request, action: "DECLINE")
async let popup = actions.submit(request, action: "ACCEPT")
let successes = await [watch, popup]
try expect(successes.allSatisfy { $0 }, "Concurrent actions should complete")
let submissions = await transport.requests
try expect(submissions.count == 1, "Duplicate submission")
try expect(submissions[0].url?.absoluteString == tokens[0].callbackUrl, "Used an untrusted payload URL")
let body = try JSONSerialization.jsonObject(with: submissions[0].httpBody!) as! [String: Any]
let signed = try NotificationBase32.decode(body["signature"] as! String)
let declined = (body["decline"] as! Int) == 1
try expect(String(decoding: signed, as: UTF8.self) == "nonce|serial" + (declined ? "|decline" : ""), "Incorrect action signature")
let stored = await actions.knownRequest(request.key)
try expect(stored?.status == (declined ? "declined" : "accepted"), "Status updated incorrectly")
try expect(await actions.pendingRequests().isEmpty, "Completed request still counted in badge")
try expect(await actions.submit(request, action: "ACCEPT"), "Completed action not deduplicated")
try expect(await transport.requests.count == 1, "Completed action submitted twice")

// Completed results survive process recreation and override a stale React snapshot.
let relaunched = EduMfaNotificationActions(defaults: defaults, usesKeychain: false)
let restored = try await relaunched.synchronize(NotificationSnapshot(tokens: tokens, requests: [request]))
try expect(restored.first?.status == stored?.status, "Native result was lost on cold launch")
try expect(await relaunched.pendingRequests().isEmpty, "Stale React state overwrote native completion")

let retry = sampleRequest(nonce: "retry")
_ = try await actions.synchronize(NotificationSnapshot(tokens: tokens, requests: [retry]))
await transport.setStatus(503)
try expect(!(await actions.submit(retry, action: "ACCEPT")), "HTTP failure marked successful")
try expect(await actions.knownRequest(retry.key)?.status == "pending", "Failure not retryable")
await transport.setStatus(200)
try expect(await actions.submit(retry, action: "ACCEPT"), "Retry failed")

let expired = sampleRequest(nonce: "expired", age: 120_001)
let countBefore = await transport.requests.count
try expect(!(await actions.submit(expired, action: "ACCEPT")), "Expired request accepted")
try expect(await actions.knownRequest(expired.key)?.status == "expired", "Expiry not recorded")
try expect(await transport.requests.count == countBefore, "Expired request reached server")

let invalidDefaults = UserDefaults(suiteName: suite + ".invalid")!
defer { invalidDefaults.removePersistentDomain(forName: suite + ".invalid") }
let invalid = EduMfaNotificationActions(
  defaults: invalidDefaults, usesKeychain: false, verify: { _, _ in false },
  send: { _ in throw TestFailure.assertion("Invalid signature reached network") }
)
_ = try await invalid.synchronize(NotificationSnapshot(tokens: tokens, requests: []))
try expect(!(await invalid.submit(sampleRequest(), action: "ACCEPT")), "Invalid signature accepted")
try expect(await invalid.actionResults().isEmpty, "Unverified request persisted")
try expect(!(await actions.submit(sampleRequest(nonce: "unknown-action"), action: "OTHER")), "Unknown action accepted")

_ = try await invalid.synchronize(NotificationSnapshot(tokens: [], requests: []))
try expect(!(await invalid.submit(sampleRequest(), action: "ACCEPT")), "Unknown token accepted")

let invalidCallback = EduMfaNotificationActions(
  defaults: invalidDefaults, usesKeychain: false, verify: { _, _ in true },
  send: { _ in throw TestFailure.assertion("Invalid callback reached network") }
)
_ = try await invalidCallback.synchronize(NotificationSnapshot(
  tokens: [NotificationToken(id: "serial", callbackUrl: "file:///tmp/untrusted", serverPublicKey: "key")],
  requests: []
))
try expect(!(await invalidCallback.submit(sampleRequest(nonce: "invalid-url"), action: "ACCEPT")), "Invalid callback accepted")

let secondBackend = NotificationToken(id: "other", callbackUrl: "https://other.example/push", serverPublicKey: "other-key")
let other = NotificationPushRequest(
  id: "other", status: "pending", sentAt: Date().timeIntervalSince1970 * 1000,
  nonce: "other", question: "Sign in?", serial: "other", signature: "MY======",
  sslverify: "1", title: "Login", url: secondBackend.callbackUrl
)
_ = try await actions.synchronize(NotificationSnapshot(tokens: tokens + [secondBackend], requests: [sampleRequest(nonce: "new"), other]))
try expect(await actions.pendingRequests().count == 2, "Badge failed to aggregate independent backends")

let remote = try NotificationPushRequest.from(
  userInfo: ["body": ["nonce": "remote", "question": "Sign in?", "serial": "serial",
                     "signature": "MY======", "sslverify": "1", "title": "Login", "url": tokens[0].callbackUrl]],
  identifier: "apns", date: Date()
)
try expect(remote.nonce == "remote" && remote.id == "apns", "APNs response data not parsed")

// Clearing an app snapshot removes mirrored requests but preserves background
// deliveries that JavaScript has not yet recovered.
let journalDefaults = UserDefaults(suiteName: suite + ".journal")!
defer { journalDefaults.removePersistentDomain(forName: suite + ".journal") }
let journal = EduMfaNotificationActions(
  defaults: journalDefaults, usesKeychain: false, verify: { _, _ in true }
)
let mirrored = sampleRequest(nonce: "mirrored")
let delivered = sampleRequest(nonce: "delivered")
_ = try await journal.synchronize(NotificationSnapshot(tokens: tokens, requests: [mirrored]))
await journal.recordDelivered(delivered)
let recovered = try await journal.synchronize(NotificationSnapshot(tokens: tokens, requests: []))
try expect(await journal.knownRequest(mirrored.key) == nil, "Removed app request remained in journal")
try expect(recovered.map(\.nonce) == [delivered.nonce], "Background delivery lost during snapshot merge")
try expect(await journal.pendingRequests().count == 1, "Journal counted removed app requests")

let coldJournal = EduMfaNotificationActions(defaults: journalDefaults, usesKeychain: false)
let coldRecovered = try await coldJournal.synchronize(NotificationSnapshot(tokens: tokens, requests: []))
try expect(coldRecovered.map(\.nonce) == [delivered.nonce], "Background delivery lost on cold launch")

var completed = delivered
completed.status = "accepted"
let newerState = try await journal.synchronize(NotificationSnapshot(tokens: tokens, requests: [completed]))
try expect(newerState.first?.status == "accepted", "App completion replaced by an older pending native entry")

let old = sampleRequest(nonce: "old-delivery", age: 120_001)
await journal.recordDelivered(old)
await journal.expireRequests()
_ = try await journal.synchronize(NotificationSnapshot(tokens: tokens, requests: [old]))
try expect(await journal.knownRequest(old.key)?.status == "expired", "Stale app snapshot resurrected expired native request")

// Migrate the previous request/result stores without losing a Watch completion.
let legacyDefaults = UserDefaults(suiteName: suite + ".legacy")!
defer { legacyDefaults.removePersistentDomain(forName: suite + ".legacy") }
legacyDefaults.set(try JSONEncoder().encode([delivered, mirrored]), forKey: "eduMFA.notificationRequests")
legacyDefaults.set(try JSONEncoder().encode([completed]), forKey: "eduMFA.notificationResults")
let migrated = EduMfaNotificationActions(defaults: legacyDefaults, usesKeychain: false)
let migratedResults = try await migrated.synchronize(NotificationSnapshot(tokens: tokens, requests: [delivered, mirrored]))
try expect(migratedResults.first?.status == "accepted", "Migration lost a native completion")
try expect(await migrated.pendingRequests().count == 1, "Migration lost mirrored pending requests")
try expect(legacyDefaults.data(forKey: "eduMFA.notificationState") != nil, "Single journal was not saved")
try expect(legacyDefaults.object(forKey: "eduMFA.notificationRequests") == nil &&
           legacyDefaults.object(forKey: "eduMFA.notificationResults") == nil, "Legacy stores were not removed")

// Separate app/extension stores reload one locked file. Arrivals must count
// across backends, deduplicate redelivery, and preserve actions taken elsewhere.
let folder = FileManager.default.temporaryDirectory.appendingPathComponent(suite)
defer { try? FileManager.default.removeItem(at: folder) }
let appDefaults = UserDefaults(suiteName: suite + ".app")!
let extensionDefaults = UserDefaults(suiteName: suite + ".extension")!
defer {
  appDefaults.removePersistentDomain(forName: suite + ".app")
  extensionDefaults.removePersistentDomain(forName: suite + ".extension")
}
let appStore = NotificationJournalStore(defaults: appDefaults, directory: folder)
let extensionStore = NotificationJournalStore(defaults: extensionDefaults, directory: folder)
let sharedActions = EduMfaNotificationActions(
  usesKeychain: false, store: appStore, verify: { _, _ in true },
  sign: { message, _ in Data(message.utf8).base64EncodedString() },
  send: { try await transport.respond($0) }
)
_ = try await sharedActions.synchronize(NotificationSnapshot(tokens: tokens + [secondBackend], requests: []))
let arrival = sampleRequest(nonce: "arrival")
try expect(try extensionStore.recordArrival(arrival, verify: { _, _ in true }) == 1, "Arrival badge not set")
try expect(try extensionStore.recordArrival(other, verify: { _, _ in true }) == 2, "Arrival failed to aggregate backends")
try expect(try extensionStore.recordArrival(arrival, verify: { _, _ in true }) == 2, "Redelivery double-counted")
try expect(try extensionStore.recordArrival(sampleRequest(nonce: "invalid"), verify: { _, _ in false }) == nil, "Invalid signature changed badge")
try expect(try extensionStore.recordArrival(old, verify: { _, _ in true }) == 2, "Expired arrival counted")
try expect(try await sharedActions.badgeCount() == 2, "App cache missed extension arrivals")

async let completing = sharedActions.submit(arrival, action: "ACCEPT")
try await Task.sleep(nanoseconds: 5_000_000)
let concurrent = sampleRequest(nonce: "during-action")
_ = try extensionStore.recordArrival(concurrent, verify: { _, _ in true })
try expect(await completing, "Shared action failed")
try expect(try appStore.read().pendingCount == 2, "Action overwrote an extension arrival")
_ = try await sharedActions.synchronize(NotificationSnapshot(tokens: tokens + [secondBackend], requests: [arrival]))
try expect(try extensionStore.recordArrival(arrival, verify: { _, _ in true }) == 2, "Redelivery resurrected accepted request")
try expect(await sharedActions.knownRequest(arrival.key)?.status == "accepted", "Stale app snapshot overwrote shared outcome")

let beforeConcurrent = try appStore.read().pendingCount
try await withThrowingTaskGroup(of: Void.self) { group in
  for index in 0..<20 {
    group.addTask {
      let independentStore = NotificationJournalStore(
        defaults: UserDefaults(suiteName: suite + ".extension")!, directory: folder
      )
      _ = try independentStore.recordArrival(sampleRequest(nonce: "parallel-\(index)"), verify: { _, _ in true })
    }
  }
  try await group.waitForAll()
}
try expect(try appStore.read().pendingCount == beforeConcurrent + 20, "Concurrent arrivals lost updates")

// Even if the extension creates the shared file first, the app's legacy
// completed journal must migrate on its first shared transaction.
let migrationFolder = folder.appendingPathComponent("migration")
let emptyExtension = NotificationJournalStore(defaults: extensionDefaults, directory: migrationFolder)
try expect(try emptyExtension.recordArrival(arrival, verify: { _, _ in true }) == nil, "Unknown enrollment changed badge")
let savedEntry = NotificationJournalEntry(request: completed, isNative: true)
appDefaults.set(try JSONEncoder().encode([savedEntry]), forKey: "eduMFA.notificationJournal")
let migratingApp = NotificationJournalStore(defaults: appDefaults, directory: migrationFolder)
try migratingApp.transaction { state in state.tokens = tokens }
try expect(try emptyExtension.read().entries[completed.key]?.request.status == "accepted", "Extension-first startup lost legacy completion")
print("Native notification action regression tests passed")
