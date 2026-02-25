import {
  InvalidUrlError,
  OtpProtocolError,
  UnsupportedVersionError,
} from "@/errors/tokenErrors";
import { useToken } from "@/hooks/useToken";
import { useLingui } from "@lingui/react/macro";
import * as Haptics from "expo-haptics";
import { useCallback } from "react";
import { Alert, Linking, Platform } from "react-native";

type TokenUriSource = "qr" | "deepLink";

const openTwoFas = () => {
  const url = Platform.select({
    ios: "itms-apps://apps.apple.com/app/id1217793794",
    android: "market://details?id=com.twofas.authenticator",
  });

  if (url) {
    Linking.openURL(url);
  }
};

const searchAuthenticatorApps = () => {
  const url = Platform.select({
    ios: "itms-apps://apps.apple.com/search?term=authenticator",
    android: "market://search?q=authenticator",
  });

  if (url) {
    Linking.openURL(url);
  }
};

export const useHandleTokenUri = () => {
  const { createTokenFromURI } = useToken();
  const { t } = useLingui();

  return useCallback(
    async (uri: string | null, source: TokenUriSource = "qr") => {
      if (uri === null) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          t`No QR code found`,
          t`Your image did not contain a QR code.`,
        );
        return false;
      }

      try {
        await createTokenFromURI(uri);
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
        return true;
      } catch (error) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

        if (error instanceof InvalidUrlError) {
          Alert.alert(
            t`Failed to add token`,
            t`The provided QR code isn't a valid eduMFA token.`,
          );
          return false;
        }

        if (error instanceof OtpProtocolError) {
          Alert.alert(
            t`Failed to add token`,
            t`The QR code isn't supported by this app. Please use a general Authenticator app. We recommend 2FAS.`,
            [
              {
                text: t`Download 2FAS`,
                onPress: openTwoFas,
                isPreferred: true,
              },
              {
                text: t`Search Authenticator Apps`,
                onPress: searchAuthenticatorApps,
              },
              { text: t`Dismiss`, style: "cancel" },
            ],
            { cancelable: true },
          );
          return false;
        }

        if (error instanceof UnsupportedVersionError) {
          Alert.alert(
            t`Failed to add token`,
            t`The token version is not supported by this app. Please update the app to the latest version or contact your institution for assistance.`,
          );
          return false;
        }
        throw error;
      }
    },
    [createTokenFromURI, t],
  );
};
