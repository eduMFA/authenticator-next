import {
  EditableTokenFields,
  getEditableTokenFields,
  getParamValue,
} from "@/components/token-detail/token-detail-utils";
import { TokenEditContent } from "@/components/token-detail/token-edit-content";
import { TokenOverviewContent } from "@/components/token-detail/token-overview-content";
import { Spacing } from "@/constants/theme";
import { useDeleteTokenConfirmation } from "@/hooks/use-delete-token-confirmation";
import { useTheme } from "@/hooks/use-theme";
import { useToken } from "@/hooks/use-token";
import ArrowBackSymbol from "@expo/material-symbols/arrow_back.xml";
import CheckSymbol from "@expo/material-symbols/check.xml";
import CloseSymbol from "@expo/material-symbols/close.xml";
import DeleteSymbol from "@expo/material-symbols/delete.xml";
import EditSymbol from "@expo/material-symbols/edit.xml";
import { useLingui } from "@lingui/react/macro";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Platform, StyleSheet, useColorScheme } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function TokenScrollView({
  animationKey,
  children,
  contentTopInset,
  keyboardShouldPersistTaps,
}: {
  animationKey: string;
  children: ReactNode;
  contentTopInset: number;
  keyboardShouldPersistTaps?: "always" | "handled" | "never";
}) {
  const theme = useTheme();
  const backgroundColor = theme.background;

  return (
    <Animated.ScrollView
      key={animationKey}
      automaticallyAdjustContentInsets
      contentContainerStyle={[styles.content, { paddingTop: contentTopInset }]}
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
  const { top } = useSafeAreaInsets();
  const { t } = useLingui();
  const theme = useTheme();
  const transparentColor = theme.transparent;
  const tabBarBackgroundColor = theme.background;
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
        hidden={Platform.OS === "android"}
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
          icon={
            isEditingActive
              ? process.env.EXPO_OS === "ios"
                ? "xmark"
                : CloseSymbol
              : process.env.EXPO_OS === "ios"
                ? "chevron.left"
                : ArrowBackSymbol
          }
          onPress={isEditingActive ? cancelEditing : () => router.back()}
        />
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel={t`Save`}
          hidden={!token || !isEditingActive}
          icon={process.env.EXPO_OS === "ios" ? "checkmark" : CheckSymbol}
          onPress={saveEditing}
          variant="prominent"
        />
        <Stack.Toolbar.Button
          accessibilityLabel={t`Edit`}
          hidden={!token || isEditingActive}
          icon={
            process.env.EXPO_OS === "ios" ? "square.and.pencil" : EditSymbol
          }
          onPress={startEditing}
        />
        <Stack.Toolbar.Button
          accessibilityLabel={t`Delete`}
          hidden={!token || isEditingActive}
          icon={process.env.EXPO_OS === "ios" ? "trash" : DeleteSymbol}
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
          contentTopInset={Platform.OS === "android" ? top : 0}
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
          contentTopInset={Platform.OS === "android" ? top : 0}
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
  },
  scroll: {
    flex: 1,
  },
});
