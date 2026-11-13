import { SETTINGS_LINKS } from "@/constants/settings";
import {
  openAppSettings,
  openExternalLink,
  openWebLink,
} from "@/utils/open-links";
import { i18n } from "@lingui/core";
import * as Linking from "expo-linking";
import { openBrowserAsync, WebBrowserResultType } from "expo-web-browser";
import { Alert, Platform } from "react-native";

jest.mock("expo-linking", () => ({
  openSettings: jest.fn(),
  openURL: jest.fn(),
}));
jest.mock("expo-web-browser", () => ({
  openBrowserAsync: jest.fn(),
  WebBrowserResultType: { CANCEL: "cancel" },
}));

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
  jest.replaceProperty(Platform, "OS", "ios");
  jest.mocked(Linking.openSettings).mockResolvedValue(undefined);
  jest.mocked(Linking.openURL).mockResolvedValue(true);
  jest.mocked(openBrowserAsync).mockResolvedValue({
    type: WebBrowserResultType.CANCEL,
  });
});

test("opens Settings and the App Store through the OS", async () => {
  await openAppSettings();
  await openExternalLink(SETTINGS_LINKS.reviewIos);
  expect(Linking.openSettings).toHaveBeenCalledTimes(1);
  expect(Linking.openURL).toHaveBeenCalledWith(SETTINGS_LINKS.reviewIos);
  expect(openBrowserAsync).not.toHaveBeenCalled();
  expect(Alert.alert).not.toHaveBeenCalled();
});

test("shows manual instructions when iOS declines to open Settings", async () => {
  jest
    .mocked(Linking.openSettings)
    .mockRejectedValueOnce(new Error("Unable to open app settings"));
  await openAppSettings();
  expect(Alert.alert).toHaveBeenCalledWith(
    "Couldn’t open Settings",
    "Open your device’s Settings app and find eduMFA Push.",
  );
});

test.each([
  SETTINGS_LINKS.github,
  SETTINGS_LINKS.privacy,
  SETTINGS_LINKS.website,
])("opens %s directly in the iOS in-app browser", async (url) => {
  await openWebLink(url);
  expect(openBrowserAsync).toHaveBeenCalledWith(url);
  expect(Linking.openURL).not.toHaveBeenCalled();
  expect(Alert.alert).not.toHaveBeenCalled();
});

test("hands the link to iOS if presenting the in-app browser fails", async () => {
  jest.mocked(openBrowserAsync).mockRejectedValueOnce(new Error());
  await openWebLink(SETTINGS_LINKS.privacy);
  expect(Linking.openURL).toHaveBeenCalledWith(SETTINGS_LINKS.privacy);
  expect(Alert.alert).not.toHaveBeenCalled();
});

test("shows the URL if both openers fail", async () => {
  jest.mocked(Linking.openURL).mockRejectedValueOnce(new Error());
  jest.mocked(openBrowserAsync).mockRejectedValueOnce(new Error());
  await openWebLink(SETTINGS_LINKS.privacy);
  expect(Alert.alert).toHaveBeenCalledWith(
    "Couldn’t open link",
    SETTINGS_LINKS.privacy,
  );
});

test.each([
  ["ios", SETTINGS_LINKS.reviewAndroid],
  ["android", SETTINGS_LINKS.privacy],
] as const)("uses the system opener on %s for %s", async (os, url) => {
  jest.replaceProperty(Platform, "OS", os);
  jest.mocked(Linking.openURL).mockRejectedValueOnce(new Error());
  await openWebLink(url);
  expect(openBrowserAsync).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledWith("Couldn’t open link", url);
});
