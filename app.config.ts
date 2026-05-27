import { ExpoConfig } from "expo/config";

const APP_ID = "io.edumfa.app";

const config: ExpoConfig = {
  owner: "edumfa",
  name: "eduMFA",
  slug: "edumfa",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/app-icons/icon-default.png",
  userInterfaceStyle: "automatic",
  scheme: "edumfa-push",
  assetBundlePatterns: ["**/*"],
  ios: {
    icon: "./assets/app-icons/edumfa.icon",
    supportsTablet: false,
    bundleIdentifier: APP_ID,
    userInterfaceStyle: "automatic",
    config: {
      usesNonExemptEncryption: false,
    },
    entitlements: {
      "aps-environment": "production",
    },
    infoPlist: {
      UIBackgroundModes: ["remote-notification", "fetch"],
    },
    googleServicesFile: "./GoogleService-Info.plist",
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/app-icons/icon-android.png",
      monochromeImage: "./assets/app-icons/icon-monochrome-android.png",
    },
    userInterfaceStyle: "automatic",
    package: APP_ID,
    softwareKeyboardLayoutMode: "pan",
    googleServicesFile: "./google-services.json",
  },
  plugins: [
    "expo-font",
    "expo-image",
    "expo-notifications",
    "expo-router",
    "expo-dev-client",
    "@react-native-firebase/app",
    "@react-native-firebase/messaging",
    [
      "expo-splash-screen",
      {
        image: "./assets/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          image: "./assets/splash-icon-dark.png",
          backgroundColor: "#000000",
        },
      },
    ],
    [
      "expo-camera",
      {
        cameraPermission:
          "Allow $(PRODUCT_NAME) to access your camera to scan QR codes",
        recordAudioAndroid: false,
      },
    ],
    [
      "expo-localization",
      {
        supportedLocales: {
          ios: ["en", "de"],
          android: ["en", "de"],
        },
      },
    ],
    [
      "expo-build-properties",
      {
        ios: {
          useFrameworks: "static",
          forceStaticLinking: ["RNFBApp", "RNFBMessaging", "FastSquircle"],
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    eas: {
      projectId: "8cdff50f-8514-4302-92e8-eaf5723979ee",
    },
  },
};

export default config;
