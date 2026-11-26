# eduMFA notifications

The iOS module handles Accept/Decline actions in the background, including
actions forwarded from Apple Watch. `EduMfaRsa` owns RSA and Keychain key access;
this module depends on that pod rather than duplicating crypto.

- `EduMfaNotificationDelegate` holds the system completion callback until an
  action finishes and forwards other notification events to Expo/Firebase.
- `EduMfaNotificationActions` verifies and submits actions. One persistent journal
  in the App Group tracks request state; native outcomes override stale app snapshots. Entries
  mirrored from the app can be removed by a later snapshot, while native entries
  remain recoverable for 24 hours. Existing two-store data migrates on first sync.
- `EduMfaNotificationPresentation` clears resolved notifications and updates the
  aggregate badge across enrolled backends.
- `extension/NotificationService.swift` verifies incoming APNs alerts and sets
  their badge before delivery, even when the main app is closed. The app and
  extension share a file protected until first unlock, with cross-process locking
  to preserve simultaneous arrivals and action outcomes. Private signing keys
  stay in the app's Keychain; only enrolled public configuration is shared.
- `preview/NotificationViewController.swift` supplies the iPhone/iPad expanded
  notification UI on long press for `PUSH_AUTHENTICATION`. It verifies the request
  and shows its message, enrolled account label, registered server and current
  status. The view supports Dynamic Type, light/dark appearance, scrolling, and
  English/German localization. iOS provides the existing Accept/Decline buttons;
  the preview does not intercept actions or poll the backend. This is separate
  from the service extension and does not change Apple Watch's interface.
- `EduMfaNotificationsModule` exposes synchronization, submission, and completion
  events to JavaScript through `src/utils/native-notifications.ts`.

Android uses Firebase's background JavaScript handler and Expo local notifications.
It does not require this native module. The app coordinates both platforms through
`src/services/notification-state.ts` and `src/services/push-notification.ts`.

Run `bun run test:ios-notifications` for the native action regression checks.
The `with-notification-service` Expo config plugin creates and embeds the service
and preview targets and declares their EAS credentials. The app and both extensions require the
`group.io.edumfa.app.notifications` App Group capability in their provisioning
profiles. The backend must send `aps.mutable-content: 1` with its alert.
Adding this module requires updated iOS pods and a new native app build. The app
must run once after upgrading to publish enrolled configuration into shared storage.
The preview uses the existing `aps.category` and signed `body` payload; it does not
require `content-available`. A fresh iOS prebuild/build and a provisioning profile
for `io.edumfa.app.NotificationPreview` are needed to install the content extension.
Badge updates on arrival are best effort if iOS times out the extension or storage
is unavailable before first unlock. Expiry alone does not wake the extension.
