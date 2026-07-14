import { useToken } from "@/hooks/use-token";
import { usePushRequestStore } from "@/stores/push-request";
import { useSettingsStore } from "@/stores/settings";
import { PushRequestStatus, type PushRequest } from "@/types/push-request";
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
  const { addPushRequest, clearPushRequests } = usePushRequestStore();
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

  const spawnSamplePushRequest = () => {
    if (!token) {
      return;
    }

    const id = `sample-push-request-${Date.now()}`;
    const request: PushRequest = {
      id,
      status: PushRequestStatus.Pending,
      sentAt: Date.now(),
      nonce: `${id}-nonce`,
      question: "Do you want to approve this sample sign-in?",
      serial: token.id,
      signature: "sample-signature",
      sslverify: token.sslVerify.toString(),
      title: "Sample sign-in request",
      url: token.callbackUrl,
    };

    addPushRequest(request);
  };

  return {
    clearPushRequests,
    demoRolloutFailure,
    demoRolloutSuccess,
    rolloutFirstToken,
    spawnSamplePushRequest,
    spawnSampleTokens,
    tokenActionDisabled,
    resetOnboarding,
  };
}
