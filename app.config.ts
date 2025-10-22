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
  if (IS_DEV) return `${APP_ID_PREFIX}.dev`;
  if (IS_PREVIEW) return `${APP_ID_PREFIX}.preview`;
  return `${APP_ID_PREFIX}.app`;
};

const config: ExpoConfig = {
  name: getName(),
  slug: "edumfa-authenticator",
  version: "0.0.1",
  orientation: "portrait",
  icon: "./assets/app-icons/icon-default.png",
  userInterfaceStyle: "automatic",
  scheme: "edumfa",
  assetBundlePatterns: ["**/*"],
  ios: {
    //icon: "./assets/app-icons/edumfa.icon",
    supportsTablet: true,
    bundleIdentifier: getAppId(),
    userInterfaceStyle: "automatic",
    config: {
      usesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/app-icons/icon-android.png",
      backgroundImage: "./assets/app-icons/icon-android-background.png",
      monochromeImage: "./assets/app-icons/icon-monochrome-android.png",
    },
    userInterfaceStyle: "automatic",
    package: getAppId(),
    edgeToEdgeEnabled: true,
    softwareKeyboardLayoutMode: "pan",
  },
  plugins: [
    "expo-router",
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
          "cameraPermission": "Allow $(PRODUCT_NAME) to access your camera to scan QR codes",
          "recordAudioAndroid": false
        }
      ]
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true
  },
};

export default config;
