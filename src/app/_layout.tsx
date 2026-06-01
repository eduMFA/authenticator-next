import { OnboardingSequence } from "@/components/onboarding-sequence";
import { ThemedText, useThemeColor } from "@/components/Themed";
import { useChallengePolling } from "@/hooks/useChallengePolling";
import { useHandleTokenUri } from "@/hooks/useHandleTokenUri";
import { useNotificationStore } from "@/store/notificationStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useTokenStore } from "@/store/tokenStore";
import { theme, useInterFonts } from "@/theme";
import { activateCurrentLocale } from "@/utils/locale";
import { isTokenEnrollmentUri } from "@/utils/tokenUtils";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { osName } from "expo-device";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import * as Linking from "expo-linking";
import { Stack } from "expo-router";
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

  useEffect(() => {
    activateCurrentLocale();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <I18nProvider i18n={i18n}>
      <RootLayoutContent />
    </I18nProvider>
  );
}

function RootLayoutContent() {
  const colorScheme = (useColorScheme() ?? "light") as "light" | "dark";
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const handledUrlsRef = useRef<Set<string>>(new Set());
  const initializeNotifications = useNotificationStore(
    (state) => state.initialize,
  );
  const startPendingRollouts = useTokenStore(
    (state) => state.startPendingRollouts,
  );
  const hasCompletedOnboarding = useSettingsStore(
    (state) => state.hasCompletedOnboarding,
  );
  const hasHydratedSettings = useSettingsStore((state) => state.hasHydrated);
  const handleTokenUri = useHandleTokenUri();
  const { pollChallenges } = useChallengePolling();

  const tabBarBackgroundColor = useThemeColor(theme.color.background);

  // Initialize notifications once at app startup, then start pending rollouts and poll for challenges
  useEffect(() => {
    if (!hasCompletedOnboarding) {
      return;
    }

    initializeNotifications().then((fcmToken) => {
      // Start pending rollouts after notifications are initialized
      if (fcmToken) {
        startPendingRollouts();
      }
      // Poll for any pending challenges when the app opens
      pollChallenges();
    });
  }, [
    hasCompletedOnboarding,
    initializeNotifications,
    startPendingRollouts,
    pollChallenges,
  ]);

  useEffect(() => {
    if (!hasCompletedOnboarding) {
      return;
    }

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      const wasInactive = /inactive|background/.test(appState.current);
      if (wasInactive && nextAppState === "active") {
        activateCurrentLocale();
        pollChallenges();
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [hasCompletedOnboarding, pollChallenges]);

  useEffect(() => {
    if (!hasCompletedOnboarding) {
      return;
    }

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
  }, [handleTokenUri, hasCompletedOnboarding]);

  if (!hasHydratedSettings) {
    return null;
  }

  if (!hasCompletedOnboarding) {
    return <OnboardingSequence />;
  }

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerTitle: () =>
            Platform.OS === "android" ? (
              <ThemedText fontSize={theme.fontSize20} fontWeight="bold">
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
          presentation:
            Platform.OS === "ios"
              ? isLiquidGlassAvailable() && osName !== "iPadOS"
                ? "formSheet"
                : "modal"
              : "modal",
          sheetAllowedDetents: [0.5],
          sheetInitialDetentIndex: 0,
          contentStyle: {
            backgroundColor: isLiquidGlassAvailable()
              ? "transparent"
              : tabBarBackgroundColor,
          },
        }}
      />
    </Stack>
  );
}
