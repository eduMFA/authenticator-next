import { useToken } from "@/hooks/use-token";
import { usePushRequestStore } from "@/stores/push-request";
import { useSettingsStore } from "@/stores/settings";
import { PushTokenRolloutState } from "@/types/token";

export function useDevMenu() {
  const { tokens, updateToken, rolloutToken } = useToken();
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

  return {
    clearPushRequests,
    demoRolloutFailure,
    demoRolloutSuccess,
    rolloutFirstToken,
    tokenActionDisabled,
    resetOnboarding,
  };
}
