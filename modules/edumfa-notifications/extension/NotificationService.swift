import Foundation
import OSLog
import UniformTypeIdentifiers
import UserNotifications

final class NotificationService: UNNotificationServiceExtension {
  private static let logger = Logger(subsystem: "io.edumfa.app", category: "NotificationThumbnail")
  private let completionLock = NSLock()
  private var handler: ((UNNotificationContent) -> Void)?
  private var original: UNNotificationContent?

  override func didReceive(
    _ request: UNNotificationRequest,
    withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
  ) {
    handler = contentHandler
    original = request.content
    Task {
      guard request.content.categoryIdentifier == "PUSH_AUTHENTICATION" else {
        self.finish(request.content)
        return
      }
      Self.logger.notice("Received an authentication alert in the service extension")
      guard let content = request.content.mutableCopy() as? UNMutableNotificationContent,
            let group = Bundle.main.object(forInfoDictionaryKey: "EduMfaNotificationAppGroup") as? String else {
        Self.logger.error("Notification extension configuration is incomplete")
        self.finish(request.content)
        return
      }
      var verifiedToken: NotificationToken?
      do {
        let incoming = try NotificationPushRequest.from(
          userInfo: content.userInfo, identifier: request.identifier, date: Date()
        )
        let store = NotificationJournalStore(appGroup: group)
        if let count = try store.recordArrival(incoming, verify: { request, token in
          let valid = try EduMfaRsaCrypto().verify(
            message: request.signedData(version: token.version),
            signatureBase64: NotificationBase32.decode(request.signature).base64EncodedString(),
            publicKey: token.serverPublicKey, algorithm: "SHA256"
          )
          if valid { verifiedToken = token }
          return valid
        }) {
          content.badge = NSNumber(value: count)
        }
      } catch {
        Self.logger.error("Could not record notification arrival (error \((error as NSError).code, privacy: .public))")
      }

      // A journal write failure shouldn't prevent presentation after verification.
      if let verifiedToken {
        await self.addTokenPresentation(verifiedToken, to: content)
      } else {
        Self.logger.notice("No verified enrollment for the authentication alert")
      }
      self.finish(content)
    }
  }

  private func addTokenPresentation(_ token: NotificationToken, to content: UNMutableNotificationContent) async {
    if let label = token.label?.trimmingCharacters(in: .whitespacesAndNewlines),
       !label.isEmpty, label != content.title {
      content.subtitle = label
    }
    guard let imageUrl = token.imageUrl else {
      Self.logger.notice("The verified enrollment has no saved token image")
      return
    }
    do {
      guard let attachment = try await tokenImageAttachment(imageUrl) else {
        Self.logger.error("The saved token image did not produce a supported PNG thumbnail")
        return
      }
      content.attachments.append(attachment)
      Self.logger.notice("Prepared a token thumbnail for iOS delivery")
    } catch {
      Self.logger.error("Could not attach the token thumbnail (error \((error as NSError).code, privacy: .public))")
    }
  }

  private func tokenImageAttachment(_ value: String) async throws -> UNNotificationAttachment? {
    guard let png = try await NotificationTokenImage.download(value) else { return nil }
    let file = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".png")
    do {
      try png.write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
      return try UNNotificationAttachment(
        identifier: NotificationTokenImage.attachmentIdentifier, url: file,
        options: [
          UNNotificationAttachmentOptionsTypeHintKey: UTType.png.identifier,
          UNNotificationAttachmentOptionsThumbnailHiddenKey: false,
        ]
      )
    } catch {
      try? FileManager.default.removeItem(at: file)
      throw error
    }
  }

  override func serviceExtensionTimeWillExpire() {
    Self.logger.error("The notification service extension reached its time limit")
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
