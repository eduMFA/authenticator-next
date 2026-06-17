import { NotificationHandler } from "@/components/notification-handler";
import { ThemedText } from "@/components/themed-text";
import { Typography, useInterFonts } from "@/constants/theme";
import { useChallengePolling } from "@/hooks/use-challenge-polling";
import { useHandleTokenUri } from "@/hooks/use-handle-token-uri";
import { useNotificationStatus } from "@/hooks/use-notifications";
import { useTheme } from "@/hooks/use-theme";
import { useTokenStore } from "@/store/token-store";
import { activateCurrentLocale } from "@/utils/locale";
import { isTokenEnrollmentUri } from "@/utils/token-utils";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { osName } from "expo-device";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import * as Linking from "expo-linking";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { useEffect, useRef } from "react";
import {
  AppState,
  AppStateStatus,
  Platform,
  useColorScheme,
} from "react-native";

activateCurrentLocale();

export default function RootLayout() {
  const [fontsLoaded] = useInterFonts();
  const colorScheme = useColorScheme();

  useEffect(() => {
    activateCurrentLocale();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <I18nProvider i18n={i18n}>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <RootLayoutContent />
      </ThemeProvider>
    </I18nProvider>
  );
}

function RootLayoutContent() {
  const colorScheme = (useColorScheme() ?? "light") as "light" | "dark";
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const handledUrlsRef = useRef<Set<string>>(new Set());
  const { checkPermissions, initialize: initializeNotifications } =
    useNotificationStatus();
  const startPendingRollouts = useTokenStore(
    (state) => state.startPendingRollouts,
  );
  const handleTokenUri = useHandleTokenUri();
  const { pollChallenges } = useChallengePolling();

  const theme = useTheme();
  const tabBarBackgroundColor = theme.background;

  // Initialize notifications once at app startup, then start pending rollouts and poll for challenges
  useEffect(() => {
    initializeNotifications().then(() => {
      // Start pending rollouts after notifications are initialized
      startPendingRollouts();
      // Poll for any pending challenges when the app opens
      pollChallenges();
    });
  }, [initializeNotifications, startPendingRollouts, pollChallenges]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      const wasInactive = /inactive|background/.test(appState.current);
      if (wasInactive && nextAppState === "active") {
        activateCurrentLocale();
        checkPermissions();
        pollChallenges();
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [pollChallenges, checkPermissions]);

  useEffect(() => {
    const handleIncomingUrl = async (incomingUrl: string) => {
      if (!isTokenEnrollmentUri(incomingUrl)) {
        return;
      }

      if (handledUrlsRef.current.has(incomingUrl)) {
        return;
      }

      handledUrlsRef.current.add(incomingUrl);

      await handleTokenUri(incomingUrl, "deepLink");
    };

    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl) {
        handleIncomingUrl(initialUrl);
      }
    });

    const subscription = Linking.addEventListener("url", (event) => {
      handleIncomingUrl(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, [handleTokenUri]);

  return (
    <>
      <Stack>
        <Stack.Screen
          name="index"
          options={{
            headerTitle: () =>
              Platform.OS === "android" ? (
                <ThemedText fontSize={Typography.fontSize20} fontWeight="bold">
                  Tokens
                </ThemedText>
              ) : undefined,
          }}
        />
        <Stack.Screen
          name="token/add"
          options={{
            headerTransparent: Platform.OS === "ios" ? true : false,
            title: "",
            presentation:
              Platform.OS === "ios"
                ? isLiquidGlassAvailable() && osName !== "iPadOS"
                  ? "formSheet"
                  : "modal"
                : "modal",
            sheetAllowedDetents: [0.75],
            sheetInitialDetentIndex: 0,
            gestureEnabled: false,
            contentStyle: {
              backgroundColor: isLiquidGlassAvailable()
                ? "transparent"
                : tabBarBackgroundColor,
            },
            headerBlurEffect: isLiquidGlassAvailable()
              ? undefined
              : colorScheme === "dark"
                ? "dark"
                : "light",
          }}
        />
        <Stack.Screen
          name="token/[tokenId]"
          options={{
            headerTransparent: Platform.OS === "ios" ? true : false,
            title: "",
            contentStyle: {
              backgroundColor: isLiquidGlassAvailable()
                ? "transparent"
                : tabBarBackgroundColor,
            },
          }}
        />
      </Stack>
      <NotificationHandler />
    </>
  );
}
