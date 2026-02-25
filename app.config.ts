import { ExpoConfig } from "expo/config";

const APP_ID_PREFIX = "io.edumfa";

const IS_DEV = process.env.APP_VARIANT === "development";
const IS_PREVIEW = process.env.APP_VARIANT === "preview";

const getName = () => {
  if (IS_DEV) return "React Conf (Dev)";
  if (IS_PREVIEW) return "React Conf (Preview)";
  return "eduMFA";
};

const getAppId = () => {
  if (IS_DEV) return `${APP_ID_PREFIX}.app`;
  if (IS_PREVIEW) return `${APP_ID_PREFIX}.app`;
  return `${APP_ID_PREFIX}.app`;
};

const config: ExpoConfig = {
  owner: "edumfa",
  name: getName(),
  slug: "edumfa",
  version: "0.0.1",
  orientation: "portrait",
  icon: "./assets/app-icons/icon-default.png",
  userInterfaceStyle: "automatic",
  scheme: "edumfa-push",
  assetBundlePatterns: ["**/*"],
  ios: {
    //icon: "./assets/app-icons/edumfa.icon",
    supportsTablet: false,
    bundleIdentifier: getAppId(),
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
      backgroundImage: "./assets/app-icons/icon-android-background.png",
      monochromeImage: "./assets/app-icons/icon-monochrome-android.png",
    },
    userInterfaceStyle: "automatic",
    package: getAppId(),
    softwareKeyboardLayoutMode: "pan",
    googleServicesFile: "./google-services.json",
  },
  plugins: [
    "expo-font",
    "expo-image",
    "expo-notifications",
    "expo-router",
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
        buildReactNativeFromSource: true,
        useHermesV1: true,
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
