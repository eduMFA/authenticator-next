import { useToken } from "@/hooks/use-token";
import { usePushRequestStore } from "@/store/push-request-store";
import { PushTokenRolloutState } from "@/types";
import { Stack } from "expo-router";

export function DevMenu() {
  const { tokens, updateToken, rolloutToken } = useToken();
  const { clearPushRequests } = usePushRequestStore();
  const token = tokens[0];
  const tokenActionDisabled = !token;

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

  return (
    <Stack.Toolbar.Menu>
      <Stack.Toolbar.Label>DEV</Stack.Toolbar.Label>
      <Stack.Toolbar.MenuAction
        disabled={tokenActionDisabled}
        onPress={() => {
          if (token) {
            rolloutToken(token.id);
          }
        }}
      >
        Rollout
      </Stack.Toolbar.MenuAction>
      <Stack.Toolbar.MenuAction
        disabled={tokenActionDisabled}
        onPress={demoRolloutFailure}
      >
        Demo Rollout Failure
      </Stack.Toolbar.MenuAction>
      <Stack.Toolbar.MenuAction
        disabled={tokenActionDisabled}
        onPress={demoRolloutSuccess}
      >
        Demo Rollout Success
      </Stack.Toolbar.MenuAction>
      <Stack.Toolbar.MenuAction
        onPress={() => {
          clearPushRequests();
        }}
      >
        Clear Push Requests
      </Stack.Toolbar.MenuAction>
    </Stack.Toolbar.Menu>
  );
}
