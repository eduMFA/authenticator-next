# eduMFA notifications

The iOS module handles Accept/Decline actions in the background, including
actions forwarded from Apple Watch. `EduMfaRsa` owns RSA and Keychain key access;
this module depends on that pod rather than duplicating crypto.

- `EduMfaNotificationDelegate` holds the system completion callback until an
  action finishes and forwards other notification events to Expo/Firebase.
- `EduMfaNotificationActions` verifies and submits actions. One persistent journal
  tracks request state; native outcomes override stale app snapshots. Entries
  mirrored from the app can be removed by a later snapshot, while native entries
  remain recoverable for 24 hours. Existing two-store data migrates on first sync.
- `EduMfaNotificationPresentation` clears resolved notifications and updates the
  aggregate badge across enrolled backends.
- `EduMfaNotificationsModule` exposes synchronization, submission, and completion
  events to JavaScript through `src/utils/native-notifications.ts`.

Android uses Firebase's background JavaScript handler and Expo local notifications.
It does not require this native module. The app coordinates both platforms through
`src/services/notification-state.ts` and `src/services/push-notification.ts`.

Run `bun run test:ios-notifications` for the native action regression checks.
Adding this module requires updated iOS pods and a new native app build.
