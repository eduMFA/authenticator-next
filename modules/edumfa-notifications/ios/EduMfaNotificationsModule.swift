import ExpoModulesCore
import Foundation

public final class EduMfaNotificationsModule: Module {
  private var observer: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("EduMfaNotifications")
    Events("onActionCompleted")

    OnCreate {
      self.observer = NotificationCenter.default.addObserver(
        forName: EduMfaNotificationActions.completedEvent, object: nil, queue: .main
      ) { [weak self] _ in self?.sendEvent("onActionCompleted") }
    }
    OnDestroy {
      if let observer = self.observer { NotificationCenter.default.removeObserver(observer) }
    }

    AsyncFunction("synchronize") { (json: String) async throws -> String in
      let snapshot = try JSONDecoder().decode(NotificationSnapshot.self, from: Data(json.utf8))
      _ = try await EduMfaNotificationActions.shared.synchronize(snapshot)
      await EduMfaNotificationPresentation.refresh()
      let results = await EduMfaNotificationActions.shared.actionResults()
      return String(decoding: try JSONEncoder().encode(results), as: UTF8.self)
    }

    AsyncFunction("submit") { (json: String, action: String) async throws -> Bool in
      let request = try JSONDecoder().decode(NotificationPushRequest.self, from: Data(json.utf8))
      return await EduMfaNotificationPresentation.submit(request, action: action)
    }
  }
}
