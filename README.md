# eduMFA Authenticator

This is the Expo app for the eduMFA authenticator.

## Get started

1. Install dependencies

   ```bash
   bun install
   ```

2. Start the app

   ```bash
   bunx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

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

Required setup:

- Connect this GitHub repository to EAS Workflows.
- Configure EAS credentials for iOS and Android.
- Configure Android Google Play submission credentials in EAS.
- Configure iOS App Store Connect submission credentials in EAS.
