# eduMFA Authenticator

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
