import { TokenEditContent } from "@/components/token-detail/token-edit-content";
import { TokenOverviewContent } from "@/components/token-detail/token-overview-content";
import {
  EditableTokenFields,
  getEditableTokenFields,
  getParamValue,
} from "@/components/token-detail/token-detail-utils";
import { Spacing } from "@/constants/theme";
import { useDeleteTokenConfirmation } from "@/hooks/use-delete-token-confirmation";
import { useTheme } from "@/hooks/use-theme";
import { useToken } from "@/hooks/use-token";
import { useLingui } from "@lingui/react/macro";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Platform, StyleSheet, useColorScheme } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

function TokenScrollView({
  animationKey,
  backgroundColor,
  children,
  keyboardShouldPersistTaps,
}: {
  animationKey: string;
  backgroundColor: string;
  children: ReactNode;
  keyboardShouldPersistTaps?: "always" | "handled" | "never";
}) {
  return (
    <Animated.ScrollView
      key={animationKey}
      automaticallyAdjustContentInsets
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(120)}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      showsVerticalScrollIndicator={false}
      style={[styles.scroll, { backgroundColor }]}
    >
      {children}
    </Animated.ScrollView>
  );
}

export default function TokenDetails() {
  const params = useLocalSearchParams<{
    edit?: string | string[];
    tokenId?: string | string[];
  }>();
  const { tokens, rolloutToken, updateToken } = useToken();
  const tokenId = getParamValue(params.tokenId);
  const token = tokens.find((item) => item.id === tokenId);
  const router = useRouter();
  const colorScheme = useColorScheme() || "light";
  const { t } = useLingui();
  const theme = useTheme();
  const transparentColor = theme.transparent;
  const tabBarBackgroundColor = theme.background;
  const scrollBackgroundColor = isLiquidGlassAvailable()
    ? theme.transparent
    : theme.background;
  const headerStyle = useMemo(
    () => ({
      backgroundColor:
        Platform.OS === "ios" ? transparentColor : tabBarBackgroundColor,
    }),
    [tabBarBackgroundColor, transparentColor],
  );
  const confirmDeleteToken = useDeleteTokenConfirmation({
    onDeleted: router.back,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editableFields, setEditableFields] =
    useState<EditableTokenFields | null>(null);
  const shouldOpenEditing = getParamValue(params.edit) === "1";
  const activeEditableFields =
    editableFields ??
    (shouldOpenEditing && token ? getEditableTokenFields(token) : null);
  const isEditingActive = isEditing || activeEditableFields !== null;

  useEffect(() => {
    if (!token) {
      router.back();
    }
  }, [router, token]);

  const startEditing = useCallback(() => {
    if (!token) {
      return;
    }

    setEditableFields(getEditableTokenFields(token));
    setIsEditing(true);
  }, [setEditableFields, setIsEditing, token]);

  const clearEditParam = useCallback(() => {
    router.setParams({ edit: undefined });
  }, [router]);

  const cancelEditing = useCallback(() => {
    setEditableFields(null);
    setIsEditing(false);
    clearEditParam();
  }, [clearEditParam, setEditableFields, setIsEditing]);

  const saveEditing = useCallback(() => {
    if (!token || !activeEditableFields) {
      return;
    }

    const label = activeEditableFields.label.trim();
    if (!label) {
      Alert.alert(t`Label required`, t`Enter a label for this token.`);
      return;
    }

    updateToken(token.id, { label });
    setEditableFields(null);
    setIsEditing(false);
    clearEditParam();
  }, [
    activeEditableFields,
    clearEditParam,
    setEditableFields,
    setIsEditing,
    t,
    token,
    updateToken,
  ]);

  const retryRollout = useCallback(() => {
    if (!token) {
      return;
    }

    void rolloutToken(token.id);
  }, [rolloutToken, token]);

  return (
    <>
      <Stack.Header
        blurEffect={
          isLiquidGlassAvailable()
            ? undefined
            : colorScheme === "dark"
              ? "dark"
              : "light"
        }
        style={headerStyle}
      />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon={isEditingActive ? "xmark" : "chevron.left"}
          onPress={isEditingActive ? cancelEditing : () => router.back()}
        />
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel={t`Cancel`}
          hidden={!token || !isEditingActive}
          icon="arrow.uturn.backward"
          onPress={cancelEditing}
        />
        <Stack.Toolbar.Button
          accessibilityLabel={t`Save`}
          hidden={!token || !isEditingActive}
          icon="checkmark"
          onPress={saveEditing}
          variant="prominent"
        />
        <Stack.Toolbar.Button
          accessibilityLabel={t`Edit`}
          hidden={!token || isEditingActive}
          icon="square.and.pencil"
          onPress={startEditing}
        />
        <Stack.Toolbar.Button
          accessibilityLabel={t`Delete`}
          hidden={!token || isEditingActive}
          icon="trash"
          onPress={() => {
            if (token) {
              confirmDeleteToken(token.id);
            }
          }}
          tintColor="#FF3B30"
        />
      </Stack.Toolbar>
      {!token ? null : isEditingActive && activeEditableFields ? (
        <TokenScrollView
          animationKey="edit"
          backgroundColor={scrollBackgroundColor}
          keyboardShouldPersistTaps="handled"
        >
          <TokenEditContent
            token={token}
            fields={activeEditableFields}
            onChange={setEditableFields}
          />
        </TokenScrollView>
      ) : (
        <TokenScrollView
          animationKey="overview"
          backgroundColor={scrollBackgroundColor}
        >
          <TokenOverviewContent token={token} onRetryRollout={retryRollout} />
        </TokenScrollView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.xl,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    paddingTop: Platform.select({ android: Spacing.xl, ios: Spacing.lg }),
  },
  scroll: {
    flex: 1,
  },
});
