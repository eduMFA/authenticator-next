import Foundation
import UserNotifications

enum EduMfaNotificationPresentation {
  static func refresh() async {
    let center = UNUserNotificationCenter.current()
    let actions = EduMfaNotificationActions.shared
    var dismiss: [String] = []
    for notification in await center.deliveredNotifications() {
      guard notification.request.content.categoryIdentifier == "PUSH_AUTHENTICATION",
            let request = try? NotificationPushRequest.from(
              userInfo: notification.request.content.userInfo,
              identifier: notification.request.identifier,
              date: notification.date
            ) else { continue }
      await actions.recordDelivered(request)
      if let known = await actions.knownRequest(request.key),
         known.status != "pending" || known.isExpired {
        dismiss.append(notification.request.identifier)
      }
    }
    await actions.expireRequests()
    center.removeDeliveredNotifications(withIdentifiers: dismiss)
    do {
      let count = try await actions.badgeCount()
      try await center.setBadgeCount(count)
    } catch {
      NSLog("[eduMFA] Could not update notification badge: %@", error.localizedDescription)
    }
  }

  static func submit(_ request: NotificationPushRequest, action: String) async -> Bool {
    let success = await EduMfaNotificationActions.shared.submit(request, action: action)
    await refresh()
    await MainActor.run {
      NotificationCenter.default.post(name: EduMfaNotificationActions.completedEvent, object: nil)
    }
    return success
  }
}
