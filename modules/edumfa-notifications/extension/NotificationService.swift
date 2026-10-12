import Foundation
import UserNotifications

final class NotificationService: UNNotificationServiceExtension {
  private let completionLock = NSLock()
  private var handler: ((UNNotificationContent) -> Void)?
  private var original: UNNotificationContent?

  override func didReceive(
    _ request: UNNotificationRequest,
    withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
  ) {
    handler = contentHandler
    original = request.content
    DispatchQueue.global(qos: .userInitiated).async {
      guard request.content.categoryIdentifier == "PUSH_AUTHENTICATION",
            let content = request.content.mutableCopy() as? UNMutableNotificationContent,
            let group = Bundle.main.object(forInfoDictionaryKey: "EduMfaNotificationAppGroup") as? String else {
        self.finish(request.content)
        return
      }
      do {
        let incoming = try NotificationPushRequest.from(
          userInfo: content.userInfo, identifier: request.identifier, date: Date()
        )
        let store = NotificationJournalStore(appGroup: group)
        if let count = try store.recordArrival(incoming, verify: { request, token in
          try EduMfaRsaCrypto().verify(
            message: request.signedData,
            signatureBase64: NotificationBase32.decode(request.signature).base64EncodedString(),
            publicKey: token.serverPublicKey, algorithm: "SHA256"
          )
        }) {
          content.badge = NSNumber(value: count)
        }
        self.finish(content)
      } catch {
        NSLog("[eduMFA] Notification badge update failed: %@", String(describing: error))
        self.finish(request.content)
      }
    }
  }

  override func serviceExtensionTimeWillExpire() {
    if let original { finish(original) }
  }

  private func finish(_ content: UNNotificationContent) {
    completionLock.lock()
    let callback = handler
    handler = nil
    completionLock.unlock()
    callback?(content)
  }
}
