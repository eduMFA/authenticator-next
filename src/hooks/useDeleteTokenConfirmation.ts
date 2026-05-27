import { useToken } from "@/hooks/useToken";
import { useLingui } from "@lingui/react/macro";
import { useCallback } from "react";
import { Alert } from "react-native";

export function useDeleteTokenConfirmation({
  onDeleted,
}: {
  onDeleted?: () => void;
} = {}) {
  const { t } = useLingui();
  const { deleteToken } = useToken();

  return useCallback(
    (tokenId: string) => {
      Alert.alert(
        t`Delete token`,
        t`Are you sure you want to delete this token?`,
        [
          { text: t`Cancel`, style: "cancel" },
          {
            text: t`Delete`,
            style: "destructive",
            onPress: () => {
              void deleteToken(tokenId).then(() => {
                onDeleted?.();
              });
            },
          },
        ],
      );
    },
    [deleteToken, onDeleted, t],
  );
}
