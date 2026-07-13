import { useToken } from "@/hooks/use-token";
import { usePushRequestStore } from "@/stores/push-request";
import { useSettingsStore } from "@/stores/settings";
import { PushTokenRolloutState, type PushToken } from "@/types/token";
import { Alert } from "react-native";

const sampleTokens: PushToken[] = [1, 2, 3].map((index) => ({
  id: `sample-university-${index}`,
  version: 1,
  label: `University ${index}`,
  issuer: "eduMFA",
  callbackUrl: `https://example.edu/edumfa/sample/${index}`,
  ttl: 10,
  enrollmentCredential: `sample-enrollment-credential-${index}`,
  sslVerify: true,
  rolloutState: PushTokenRolloutState.Completed,
}));

export function useDevMenu() {
  const { tokens, addToken, deleteToken, updateToken, rolloutToken } =
    useToken();
  const { clearPushRequests } = usePushRequestStore();
  const token = tokens[0];
  const tokenActionDisabled = !token;
  const resetOnboarding = useSettingsStore((state) => state.resetOnboarding);

  const updateTokenRolloutState = (
    tokenId: string,
    rolloutState: PushTokenRolloutState,
  ) => {
    updateToken(tokenId, { rolloutState });
  };

  const demoRolloutFailure = () => {
    if (!token) {
      return;
    }

    updateTokenRolloutState(token.id, PushTokenRolloutState.Pending);
    setTimeout(() => {
      updateTokenRolloutState(token.id, PushTokenRolloutState.RSAKeyGeneration);
    }, 1000);
    setTimeout(() => {
      updateTokenRolloutState(token.id, PushTokenRolloutState.SendRSAPublicKey);
    }, 2000);
    setTimeout(() => {
      updateTokenRolloutState(
        token.id,
        PushTokenRolloutState.SendRSAPublicKeyFailed,
      );
    }, 4000);
  };

  const demoRolloutSuccess = () => {
    if (!token) {
      return;
    }

    updateTokenRolloutState(token.id, PushTokenRolloutState.Pending);
    setTimeout(() => {
      updateTokenRolloutState(token.id, PushTokenRolloutState.RSAKeyGeneration);
    }, 1000);
    setTimeout(() => {
      updateTokenRolloutState(token.id, PushTokenRolloutState.SendRSAPublicKey);
    }, 2000);
    setTimeout(() => {
      updateTokenRolloutState(token.id, PushTokenRolloutState.ParsingResponse);
    }, 4000);
    setTimeout(() => {
      updateTokenRolloutState(token.id, PushTokenRolloutState.Completed);
    }, 5000);
  };

  const rolloutFirstToken = () => {
    if (token) {
      rolloutToken(token.id);
    }
  };

  const spawnSampleTokens = () => {
    Alert.alert(
      "Spawn sample token data?",
      "This clears all existing tokens and replaces them with 3 sample tokens.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Spawn",
          style: "destructive",
          onPress: () => {
            void Promise.all(
              tokens.map((existingToken) => deleteToken(existingToken.id)),
            ).then(() => {
              sampleTokens.forEach(addToken);
            });
          },
        },
      ],
    );
  };

  return {
    clearPushRequests,
    demoRolloutFailure,
    demoRolloutSuccess,
    rolloutFirstToken,
    spawnSampleTokens,
    tokenActionDisabled,
    resetOnboarding,
  };
}
