import {
  handleAppIntents,
  publishTokenCatalog,
  publishChallengeCatalog,
} from "@/services/app-intents";
import { usePushRequestStore } from "@/stores/push-request";
import { useLingui } from "@lingui/react/macro";
import { useTokenStore } from "@/stores/token";
import * as AppIntents from "expo-app-intents";
import { useRootNavigationState } from "expo-router";
import { useEffect, useSyncExternalStore } from "react";
import { Alert } from "react-native";

const subscribeToHydration = (onChange: () => void) => {
  const unsubscribeStart = useTokenStore.persist.onHydrate(onChange);
  const unsubscribeFinish = useTokenStore.persist.onFinishHydration(onChange);
  const unsubscribeRequestsStart =
    usePushRequestStore.persist.onHydrate(onChange);
  const unsubscribeRequestsFinish =
    usePushRequestStore.persist.onFinishHydration(onChange);
  return () => {
    unsubscribeStart();
    unsubscribeFinish();
    unsubscribeRequestsStart();
    unsubscribeRequestsFinish();
  };
};
const hasHydrated = () =>
  useTokenStore.persist.hasHydrated() &&
  usePushRequestStore.persist.hasHydrated();

// Mounted by the root only after settings hydration and onboarding have completed.
export function AppIntentHandler() {
  const navigation = useRootNavigationState();
  const tokensReady = useSyncExternalStore(
    subscribeToHydration,
    hasHydrated,
    () => false,
  );

  if (!tokensReady || !navigation?.key || !AppIntents.isAvailable()) {
    return null;
  }
  return <ReadyAppIntentHandler />;
}

function ReadyAppIntentHandler() {
  const { t } = useLingui();
  const tokens = useTokenStore((state) => state.tokens);
  const requests = usePushRequestStore((state) => state.pushRequests);

  useEffect(() => {
    void publishTokenCatalog(tokens).catch((error: unknown) => {
      console.warn("Could not publish push tokens to Shortcuts", error);
    });
  }, [tokens]);

  useEffect(() => {
    void publishChallengeCatalog(requests, tokens).catch((error: unknown) => {
      console.warn("Could not publish sign-in requests to Shortcuts", error);
    });
  }, [requests, tokens]);

  AppIntents.useAppIntents((pending) =>
    handleAppIntents(pending, (error) => {
      Alert.alert(
        error ? t`Sign-in response needs attention` : t`Sign-in response sent`,
        error?.message ?? t`Your response was sent to the server.`,
      );
    }),
  );
  return null;
}
