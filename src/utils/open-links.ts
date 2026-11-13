import { t } from "@lingui/core/macro";
import * as Linking from "expo-linking";
import { openBrowserAsync } from "expo-web-browser";
import { Alert, Platform } from "react-native";

export async function openAppSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    Alert.alert(
      t`Couldn’t open Settings`,
      t`Open your device’s Settings app and find eduMFA Push.`,
    );
  }
}

export async function openExternalLink(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(t`Couldn’t open link`, url);
  }
}

export async function openWebLink(url: string): Promise<void> {
  if (Platform.OS === "ios" && /^https?:\/\//i.test(url)) {
    try {
      await openBrowserAsync(url);
      return;
    } catch {
      // Try the system opener if Safari cannot be presented in the app.
    }
  }
  await openExternalLink(url);
}
