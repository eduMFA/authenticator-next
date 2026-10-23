# eduMFA Push

This app is the client-side implementation of eduMFA's [`edupush` token type](https://edumfa.readthedocs.io/en/latest/tokens/tokentypes/edupush.html). It enrolls push tokens and lets users approve or deny sign-in requests from their eduMFA server.

## Get started

1. Install dependencies

   ```bash
   bun install
   ```

2. Generate the native projects

   ```bash
   bunx expo prebuild
   ```

   The app requires native dependencies, including React Native Firebase. [Expo Prebuild](https://docs.expo.dev/workflow/prebuild/) generates the Android and iOS projects and applies their native configuration.

3. Build and run a development app

   With Android Studio or Xcode installed, run the command for your platform:

   ```bash
   bun run android
   # or, on macOS
   bun run ios
   ```

4. Start the development server for subsequent sessions

   ```bash
   bunx expo start --dev-client
   ```

Open the installed development app on your device, Android emulator, or iOS simulator. Regenerate and rebuild the native app when native dependencies or app configuration change.

You can start developing by editing the files inside the **src/app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Siri and Shortcuts

iOS exposes **List Push Tokens**, **Open Push Tokens**, **Open Push Token**,
**Pair Push Token**, **List Sign-in Requests**, **Approve Sign-in Request**, and **Deny Sign-in Request** in
Shortcuts. Example Siri phrases are “List push tokens in eduMFA Push”, “Open
[token label] in eduMFA Push”, and “Pair a push token in eduMFA Push”. These actions
require device authentication. Listing returns token entities from the last
synced catalog without opening the app, so another Shortcut step can choose one
and pass it to **Open Push Token**. Open the app once after installation to populate
the catalog.

Approval and denial require choosing a specific, unexpired sign-in request and
confirming its details. They open the app to submit the response using its existing
signing service; the one-way bridge cannot return JavaScript results to Siri or a
later Shortcut step. The native dialog describes the handoff, and the app displays
the actual result. Challenge selection uses the last synced pending requests;
open the app to fetch requests that have not yet been synced. **List Sign-in Requests**
returns the unexpired cached challenge entities for use in another Shortcut step.

Response attempts are persisted before submission. Successful responses commit
the request status and invocation receipt in one storage snapshot before removing
the invocation. A replay retries acknowledgement without sending again. A failed
or interrupted attempt with an unknown server outcome requires manual review in
the app instead of automatic resubmission. Expired, deleted, handled, or malformed
requests are rejected. The existing two-minute request lifetime applies.

Swift declarations live in `app-intents/` and compile into the app target through
Expo inline modules. The root mounts one invocation consumer after onboarding,
token and request storage hydration, and navigation readiness. Failed navigation or queue
removal remains pending for the next invocation or app launch. Invalid/deleted
token references and unsupported actions are logged and discarded.

The Shortcuts token catalog contains only stable IDs, labels, and issuers, and
updates when tokens are added, renamed, or deleted. Credentials, callback URLs,
and keys are never published. Challenge catalogs contain display text and expiry
times, without nonces, signatures, or callback URLs. No Spotlight indexing or intent donations are used.
Android, web, and binaries without the native module skip the integration.

After changing native declarations or phrases, regenerate and rebuild the native
iOS app using the development commands above. Expo Go and OTA JavaScript updates
cannot install these declarations. Test each action from Shortcuts and Siri with
the app running and after terminating it; check onboarding on a fresh install,
token rename/deletion, removal of the last token, multiple challenges, both decisions,
confirmation cancellation, expiry during confirmation, and an interrupted submission. Native compilation and
on-device validation are required to verify Swift and Apple's metadata extraction.

To verify the JavaScript submission path over real HTTP against the local Postman
test double (RSA signing is mocked):

```bash
postman simulation run postman/simulations/app-intents.sim.yaml --port 4900 --no-history
# In another terminal:
APP_INTENTS_SIMULATION_URL=http://127.0.0.1:4900/edumfa bun run test --runInBand tests/challenge-intents-http.test.ts
```

The mock validates the existing client's POST payload and supplies 200/500
responses. It was authored from `src/services/push-auth.ts`; an owner-provided mock
could not be retrieved because the Postman CLI was signed out. These checks cover
local transport and state handling, not a live eduMFA server or native execution.

## Tests

```bash
bun run test --runInBand
bun run test:watch
bun run test:coverage
bun run typecheck
```

Jest uses the Expo preset with mocked native APIs and network responses. The suite covers all services, stores, utilities, rollout state helpers, errors, and token detail helpers. Coverage includes untested files within those directories and enforces at least 95% statements, lines, and functions, plus 90% branches. Screens, UI components, hooks, and native RSA implementations are outside this unit coverage scope.

The HTML report is available at `coverage/lcov-report/index.html`. Pull requests run the suite with coverage checks.

## Releases

Releases are tag-driven through EAS Workflows. The `main` branch is the development branch and does not publish store builds by itself.

Beta releases use pre-release tags:

```bash
git tag beta/0.1.0-beta.1
git push origin beta/0.1.0-beta.1

git tag beta/0.1.0-beta.2
git push origin beta/0.1.0-beta.2
```

Production releases use final version tags:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The beta workflow builds Android and iOS store binaries. Android is submitted to the Google Play open testing track. iOS is distributed to the TestFlight external group `External Testers`.

The production workflow builds Android and iOS store binaries, then waits for approval in EAS before submitting to Google Play production and App Store Connect.

Both workflows build the downloadable APK after the Android store build has reserved
the next remote build number. EAS then publishes the APK to the matching GitHub
release, so no GitHub Actions runner waits in the EAS build queue.

Required setup:

- Connect this GitHub repository to EAS Workflows.
- Configure EAS credentials for iOS and Android.
- Configure Android Google Play submission credentials in EAS.
- Configure iOS App Store Connect submission credentials in EAS.
- Add `GITHUB_RELEASE_TOKEN` as a secret EAS environment variable in the
  `production` environment. Use a fine-grained GitHub token for this repository
  with read/write access to Contents.

EAS build failure monitoring:

- The `eas-build-on-complete` script reports failed builds to Sentry. Successful
  builds are skipped unless `SENTRY_EAS_BUILD_CAPTURE_SUCCESS=true` is set.
- Set `SENTRY_DSN` in the EAS environments used by builds. It uses the existing
  app project's DSN; filter by the `eas-build` environment to find build events.
  This is separate from the `SENTRY_AUTH_TOKEN` used for source map and debug
  symbol uploads.
- Events include build identifiers, platform, profile, commit, version, build
  username, and working directory. They contain a failure summary, not full build
  logs. The hook does not change the app's runtime crash-reporting consent.
