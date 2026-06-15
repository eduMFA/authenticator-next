import { NotificationHandler } from "@/components/notification-handler";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { TokenListItem } from "@/components/token-list-item";
import { Radii, Spacing, StaticColors, Typography } from "@/constants/theme";
import { useChallengePolling } from "@/hooks/use-challenge-polling";
import { useDeleteTokenConfirmation } from "@/hooks/use-delete-token-confirmation";
import { useDevMenu } from "@/hooks/use-dev-menu";
import { useTheme } from "@/hooks/use-theme";
import { useToken } from "@/hooks/use-token";
import { PushToken, PushTokenRolloutState } from "@/types";
import AddSymbol from "@expo/material-symbols/add.xml";
import CodeSymbol from "@expo/material-symbols/code.xml";
import { Button, Text as ExpoText, Host, Icon, Row } from "@expo/ui";
import { buttonStyle, controlSize } from "@expo/ui/swift-ui/modifiers";
import { Trans, useLingui } from "@lingui/react/macro";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Link, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useMemo } from "react";
import {
  Keyboard,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function Tokens() {
  const router = useRouter();
  const { tokens, rolloutToken } = useToken();
  const devMenu = useDevMenu();
  const confirmDeleteToken = useDeleteTokenConfirmation();
  const { isPolling, pollChallenges } = useChallengePolling();
  const { height, width } = useWindowDimensions();
  const { bottom, top } = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = useTheme();
  const backgroundColor = theme.background;
  const { t } = useLingui();
  const tabBarTintColor = theme.text;
  const transparentColor = theme.transparent;
  const tabBarBackgroundColor = theme.background;
  const refreshControlTintColor =
    colorScheme === "dark" ? StaticColors.white : StaticColors.black;

  const params = useLocalSearchParams<{ q?: string }>();

  const searchText = params?.q?.trim() || "";
  const searchQuery = searchText.toLowerCase();
  const emptyStateButtonWidth = Math.min(320, width - Spacing.xl * 2);
  const showToolbarAddButton = tokens.length > 0;
  const stackHeaderStyle = useMemo(
    () => ({
      backgroundColor: isLiquidGlassAvailable()
        ? transparentColor
        : tabBarBackgroundColor,
    }),
    [tabBarBackgroundColor, transparentColor],
  );

  const filteredTokens = useMemo(() => {
    if (!searchQuery) {
      return tokens;
    }

    return tokens.filter((token) => {
      return [token.label, token.issuer, token.id]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(searchQuery));
    });
  }, [searchQuery, tokens]);

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const onRefresh = useCallback(() => {
    pollChallenges();
  }, [pollChallenges]);

  const renderItem = useCallback(
    ({ item }: { item: PushToken }) => {
      return (
        <Animated.View
          key={item.id}
          entering={FadeIn}
          exiting={FadeOut}
          style={styles.tokenWrapper}
        >
          <Link
            push
            key={item.id}
            href={{
              pathname: "/token/[tokenId]",
              params: { tokenId: item.id },
            }}
            asChild
          >
            <Link.Trigger>
              <Pressable
                onLongPress={() => {}}
                style={styles.tokenCard}
                disabled={!PushTokenRolloutState.isFinished(item.rolloutState)}
              >
                <TokenListItem token={item} key={item.id} />
              </Pressable>
            </Link.Trigger>
            <Link.Menu>
              {!PushTokenRolloutState.isFailed(item.rolloutState) && (
                <Link.MenuAction
                  icon="square.and.pencil"
                  onPress={() => {}}
                  disabled={true}
                >
                  {t`Edit`}
                </Link.MenuAction>
              )}
              {PushTokenRolloutState.isFailed(item.rolloutState) && (
                <Link.MenuAction
                  icon="arrow.clockwise"
                  onPress={() => {
                    rolloutToken(item.id);
                  }}
                >
                  {t`Retry Rollout`}
                </Link.MenuAction>
              )}
              <Link.MenuAction
                icon="trash"
                destructive
                onPress={() => confirmDeleteToken(item.id)}
              >
                {t`Delete`}
              </Link.MenuAction>
            </Link.Menu>
          </Link>
        </Animated.View>
      );
    },
    [confirmDeleteToken, rolloutToken, t],
  );

  const toolbarAddButton = (
    <Stack.Toolbar.Button
      icon="plus"
      variant="prominent"
      onPress={() => {
        router.navigate("/token/add");
      }}
    />
  );

  const header = (
    <>
      <Stack.Screen.Title large style={{ color: tabBarTintColor }}>
        Tokens
      </Stack.Screen.Title>
      {showToolbarAddButton ? (
        <Stack.SearchBar
          placement={isLiquidGlassAvailable() ? "integrated" : "stacked"}
          headerIconColor={tabBarTintColor}
          tintColor={tabBarTintColor}
          textColor={tabBarTintColor}
          placeholder={t`Search tokens`}
          onChangeText={(event) => {
            router.setParams({
              q: event.nativeEvent.text,
            });
          }}
        />
      ) : null}

      <Stack.Header style={stackHeaderStyle} />
      <Stack.Toolbar placement="right">
        {__DEV__ && (
          <Stack.Toolbar.Menu
            icon={Icon.select({
              ios: "hammer.fill",
              android: CodeSymbol,
            })}
          >
            <Stack.Toolbar.Label>DEV</Stack.Toolbar.Label>
            <Stack.Toolbar.MenuAction
              disabled={devMenu.tokenActionDisabled}
              onPress={devMenu.rolloutFirstToken}
            >
              Rollout
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction
              disabled={devMenu.tokenActionDisabled}
              onPress={devMenu.demoRolloutFailure}
            >
              Demo Rollout Failure
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction
              disabled={devMenu.tokenActionDisabled}
              onPress={devMenu.demoRolloutSuccess}
            >
              Demo Rollout Success
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction onPress={devMenu.clearPushRequests}>
              Clear Push Requests
            </Stack.Toolbar.MenuAction>
          </Stack.Toolbar.Menu>
        )}
        {Platform.OS === "ios" && !isLiquidGlassAvailable() && toolbarAddButton}
      </Stack.Toolbar>
    </>
  );

  const footer = isLiquidGlassAvailable() ? (
    <Stack.Toolbar placement="bottom">
      <Stack.Toolbar.SearchBarSlot />
      {showToolbarAddButton && toolbarAddButton}
    </Stack.Toolbar>
  ) : null;

  if (!tokens.length) {
    return (
      <>
        {header}
        <ThemedView style={styles.noTokenContainer}>
          <ThemedView type="backgroundSecondary" style={styles.noTokenIcon}>
            <SymbolView
              name={{ ios: "lock.shield", android: "shield_lock" }}
              size={36}
              tintColor={StaticColors.grey}
            />
          </ThemedView>
          <ThemedText
            fontSize={Typography.fontSize24}
            fontWeight="semiBold"
            style={styles.noTokenTitle}
          >
            <Trans>No tokens yet</Trans>
          </ThemedText>
          <ThemedText
            fontSize={Typography.fontSize16}
            fontWeight="light"
            style={styles.noTokenDescription}
            themeColor="textSecondary"
          >
            <Trans>
              Add your first eduMFA token to approve sign-ins securely from this
              device.
            </Trans>
          </ThemedText>
          <Host
            matchContents={{ vertical: true }}
            style={[styles.noTokenButton, { width: emptyStateButtonWidth }]}
          >
            <Button
              variant="filled"
              modifiers={[controlSize("large"), buttonStyle("glassProminent")]}
              onPress={() => {
                router.navigate("/token/add");
              }}
              style={{ width: emptyStateButtonWidth }}
            >
              <Row alignment="center" spacing={6}>
                <Icon
                  name={Icon.select({
                    ios: "plus",
                    android: AddSymbol,
                  })}
                  accessibilityLabel={t`Add token`}
                />
                <ExpoText numberOfLines={1}>{t`Add token`}</ExpoText>
              </Row>
            </Button>
          </Host>
        </ThemedView>
        {footer}
      </>
    );
  }

  return (
    <>
      {header}
      <NotificationHandler />
      <Animated.FlatList
        scrollToOverflowEnabled
        contentInsetAdjustmentBehavior="automatic"
        onScrollBeginDrag={dismissKeyboard}
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor }}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingBottom: Platform.select({
              android: 100 + bottom,
              default: 0,
            }),
          },
          { minHeight: height - (bottom + top + 130) },
        ]}
        renderItem={renderItem}
        data={filteredTokens}
        keyExtractor={(item) => item.id}
        itemLayoutAnimation={LinearTransition}
        ListEmptyComponent={
          <Animated.View entering={FadeIn} exiting={FadeOut}>
            <ThemedView style={styles.noResultsContainer}>
              <ThemedText>
                <Trans>No results found for </Trans>
                <ThemedText fontWeight="bold">{searchText}</ThemedText>
              </ThemedText>
            </ThemedView>
          </Animated.View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isPolling}
            onRefresh={onRefresh}
            title={t`Refreshing...`}
            tintColor={refreshControlTintColor}
            titleColor={refreshControlTintColor}
            colors={[refreshControlTintColor]}
          />
        }
      />
      {footer}
    </>
  );
}

export const styles = StyleSheet.create({
  contentContainer: {
    paddingHorizontal: Spacing.lg,
  },
  noResultsContainer: {
    padding: Spacing.xl,
  },
  noTokenButton: {
    marginTop: Spacing.xl,
  },
  noTokenContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  noTokenDescription: {
    lineHeight: Typography.fontSize16 * 1.4,
    maxWidth: 320,
    textAlign: "center",
  },
  noTokenIcon: {
    alignItems: "center",
    borderRadius: Radii.pill,
    height: 80,
    justifyContent: "center",
    marginBottom: Spacing.xl,
    width: 80,
  },
  noTokenTitle: {
    lineHeight: Typography.fontSize24 * 1.2,
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  tokenCard: {
    borderRadius: Radii.xl,
    overflow: "hidden",
  },
  tokenWrapper: {
    marginVertical: Spacing.sm,
  },
});
