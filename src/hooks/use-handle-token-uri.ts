import {
  InvalidUrlError,
  OtpProtocolError,
  UnsupportedVersionError,
} from "@/errors/token";
import { useToken } from "@/hooks/use-token";
import {
  playNotificationErrorHaptic,
  playNotificationSuccessHaptic,
} from "@/utils/haptics";
import { useLingui } from "@lingui/react/macro";
import { useCallback } from "react";
import { Alert, Linking, Platform } from "react-native";

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
    async (uri: string | null) => {
      if (uri === null) {
        playNotificationErrorHaptic();
        Alert.alert(
          t`No QR code found`,
          t`Your image did not contain a QR code.`,
        );
        return false;
      }

      try {
        await createTokenFromURI(uri);
        playNotificationSuccessHaptic();
        return true;
      } catch (error) {
        playNotificationErrorHaptic();

        if (error instanceof InvalidUrlError) {
          Alert.alert(
            t`Failed to add token`,
            t`The provided QR code isn't a valid eduMFA token.`,
          );
          return false;
        }

        if (error instanceof OtpProtocolError) {
          const hasAuthenticatorApp = await Linking.canOpenURL(uri);

          Alert.alert(
            t`Failed to add token`,
            t`The QR code isn't supported by this app. Please use a general Authenticator app.`,
            [
              {
                text: t`Dismiss`,
                style: "cancel",
              },
              ...(hasAuthenticatorApp
                ? [
                    {
                      text: t`Open with your Authenticator App`,
                      onPress: () => {
                        Linking.openURL(uri);
                      },
                      isPreferred: true,
                    },
                  ]
                : [
                    {
                      text: t`Search Authenticator Apps`,
                      onPress: searchAuthenticatorApps,
                      isPreferred: true,
                    },
                  ]),
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
