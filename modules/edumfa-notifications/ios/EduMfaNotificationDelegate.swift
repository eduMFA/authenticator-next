import ExpoModulesCore
import ExpoNotifications
import Foundation
import UIKit
import UserNotifications

// Intercept only eduMFA actions. Expo's dispatcher finishes callbacks immediately,
// whereas these actions must keep their completion handler until the POST finishes.
final class EduMfaNotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
  static let shared = EduMfaNotificationDelegate()
  var forwardingDelegate: UNUserNotificationCenterDelegate?

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    guard response.notification.request.content.categoryIdentifier == "PUSH_AUTHENTICATION",
          ["ACCEPT", "DECLINE"].contains(response.actionIdentifier) else {
      if let delegate = forwardingDelegate,
         delegate.responds(to: #selector(UNUserNotificationCenterDelegate.userNotificationCenter(_:didReceive:withCompletionHandler:))) {
        delegate.userNotificationCenter?(center, didReceive: response, withCompletionHandler: completionHandler)
      } else {
        completionHandler()
      }
      return
    }
    Task {
      defer { completionHandler() }
      guard let request = try? NotificationPushRequest.from(
        userInfo: response.notification.request.content.userInfo,
        identifier: response.notification.request.identifier,
        date: response.notification.date
      ) else { return }
      _ = await EduMfaNotificationPresentation.submit(request, action: response.actionIdentifier)
    }
  }

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    if let delegate = forwardingDelegate,
       delegate.responds(to: #selector(UNUserNotificationCenterDelegate.userNotificationCenter(_:willPresent:withCompletionHandler:))) {
      delegate.userNotificationCenter?(center, willPresent: notification, withCompletionHandler: completionHandler)
    } else {
      completionHandler([])
    }
  }

  func userNotificationCenter(_ center: UNUserNotificationCenter, openSettingsFor notification: UNNotification?) {
    forwardingDelegate?.userNotificationCenter?(center, openSettingsFor: notification)
  }
}

public final class EduMfaNotificationAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let center = UNUserNotificationCenter.current()
    let delegate = EduMfaNotificationDelegate.shared
    delegate.forwardingDelegate = center.delegate ?? NotificationCenterManager.shared
    center.delegate = delegate
    return true
  }
}
