import { StatusCard } from "@/components/status-card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { TokenListItem } from "@/components/token-list-item";
import { Radii, Spacing, StaticColors, Typography } from "@/constants/theme";
import { useChallengePolling } from "@/hooks/use-challenge-polling";
import { useDeleteTokenConfirmation } from "@/hooks/use-delete-token-confirmation";
import { useDevMenu } from "@/hooks/use-dev-menu";
import { useNotificationStatus } from "@/hooks/use-notifications";
import { useTheme } from "@/hooks/use-theme";
import { useToken } from "@/hooks/use-token";
import type { PushToken } from "@/types/token";
import { PushTokenRolloutState } from "@/types/token";
import type { TokenAction } from "@/types/token-actions";
import AddSymbol from "@expo/material-symbols/add.xml";
import AddCircleSymbol from "@expo/material-symbols/add_circle.xml";
import CancelSymbol from "@expo/material-symbols/cancel.xml";
import CheckCircleSymbol from "@expo/material-symbols/check_circle.xml";
import ClearAllSymbol from "@expo/material-symbols/clear_all.xml";
import CodeSymbol from "@expo/material-symbols/code.xml";
import DeleteSymbol from "@expo/material-symbols/delete.xml";
import KeySymbol from "@expo/material-symbols/key.xml";
import NotificationAddSymbol from "@expo/material-symbols/notification_add.xml";
import NotificationsSymbol from "@expo/material-symbols/notifications.xml";
import PlayArrowSymbol from "@expo/material-symbols/play_arrow.xml";
import RestartAltSymbol from "@expo/material-symbols/restart_alt.xml";
import SyncSymbol from "@expo/material-symbols/sync.xml";
import { Button, Text as ExpoText, Host, Icon, Row } from "@expo/ui";
import {
  Host as AndroidHost,
  Icon as AndroidIcon,
  Box,
  ExtendedFloatingActionButton,
  Text,
} from "@expo/ui/jetpack-compose";
import { imePadding } from "@expo/ui/jetpack-compose/modifiers";
import { buttonStyle, controlSize } from "@expo/ui/swift-ui/modifiers";
import { Trans, useLingui } from "@lingui/react/macro";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useMemo } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StyleSheet,
  useWindowDimensions,
  View,
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
  const {
    hasPermission: hasNotificationPermission,
    isInitialized: isNotificationInitialized,
  } = useNotificationStatus();
  const { width } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();
  const theme = useTheme();
  const backgroundColor = theme.background;
  const { t } = useLingui();
  const tabBarTintColor = theme.text;
  const transparentColor = theme.transparent;
  const tabBarBackgroundColor = theme.background;
  const refreshControlColor =
    Platform.OS === "android" ? theme.branding : theme.text;
  const refreshControlProgressBackgroundColor =
    Platform.OS === "android" ? theme.backgroundSecondary : undefined;

  const params = useLocalSearchParams<{ q?: string }>();

  const searchText = params?.q?.trim() || "";
  const searchQuery = searchText.toLowerCase();
  const emptyStateButtonWidth = Math.min(320, width - Spacing.xl * 2);
  const showToolbarAddButton = tokens.length > 0;
  const showNotificationNotice =
    isNotificationInitialized && !hasNotificationPermission;
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
      const primaryTokenAction: TokenAction = PushTokenRolloutState.isFailed(
        item.rolloutState,
      )
        ? {
            iosIcon: "arrow.clockwise",
            key: "refresh",
            label: t`Retry Rollout`,
            onPress: () => rolloutToken(item.id),
          }
        : {
            iosIcon: "square.and.pencil",
            key: "edit",
            label: t`Edit`,
            onPress: () => {
              router.push({
                pathname: "/token/[tokenId]",
                params: { edit: "1", tokenId: item.id },
              });
            },
          };
      const tokenActions: TokenAction[] = [
        primaryTokenAction,
        {
          destructive: true,
          iosIcon: "trash",
          key: "delete",
          label: t`Delete`,
          onPress: () => confirmDeleteToken(item.id),
        },
      ];
      const isRolloutFinished = PushTokenRolloutState.isFinished(
        item.rolloutState,
      );

      return (
        <Animated.View
          key={item.id}
          entering={FadeIn}
          exiting={FadeOut}
          style={styles.tokenWrapper}
        >
          <TokenListItem
            actions={tokenActions}
            isRolloutFinished={isRolloutFinished}
            token={item}
          />
        </Animated.View>
      );
    },
    [confirmDeleteToken, rolloutToken, router, t],
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
            <Stack.Toolbar.Menu
              icon={Icon.select({
                ios: "arrow.trianglehead.2.clockwise.rotate.90",
                android: SyncSymbol,
              })}
            >
              <Stack.Toolbar.Label>Rollout</Stack.Toolbar.Label>
              <Stack.Toolbar.MenuAction
                disabled={devMenu.tokenActionDisabled}
                icon={Icon.select({
                  ios: "play.fill",
                  android: PlayArrowSymbol,
                })}
                onPress={devMenu.rolloutFirstToken}
              >
                Start
              </Stack.Toolbar.MenuAction>
              <Stack.Toolbar.MenuAction
                disabled={devMenu.tokenActionDisabled}
                icon={Icon.select({
                  ios: "checkmark.circle.fill",
                  android: CheckCircleSymbol,
                })}
                onPress={devMenu.demoRolloutSuccess}
              >
                Demo Success
              </Stack.Toolbar.MenuAction>
              <Stack.Toolbar.MenuAction
                disabled={devMenu.tokenActionDisabled}
                icon={Icon.select({
                  ios: "xmark.circle.fill",
                  android: CancelSymbol,
                })}
                onPress={devMenu.demoRolloutFailure}
              >
                Demo Failure
              </Stack.Toolbar.MenuAction>
            </Stack.Toolbar.Menu>
            <Stack.Toolbar.Menu
              icon={Icon.select({
                ios: "key.fill",
                android: KeySymbol,
              })}
            >
              <Stack.Toolbar.Label>Tokens</Stack.Toolbar.Label>
              <Stack.Toolbar.MenuAction
                icon={Icon.select({
                  ios: "plus.circle.fill",
                  android: AddCircleSymbol,
                })}
                onPress={() => devMenu.spawnSampleTokens(3)}
              >
                Spawn Sample 3
              </Stack.Toolbar.MenuAction>
              <Stack.Toolbar.MenuAction
                icon={Icon.select({
                  ios: "plus.circle.fill",
                  android: AddCircleSymbol,
                })}
                onPress={() => devMenu.spawnSampleTokens(10)}
              >
                Spawn Sample 10
              </Stack.Toolbar.MenuAction>
              <Stack.Toolbar.MenuAction
                destructive
                disabled={devMenu.tokenActionDisabled}
                icon={Icon.select({
                  ios: "trash.fill",
                  android: DeleteSymbol,
                })}
                onPress={devMenu.clearAllTokens}
              >
                Clear
              </Stack.Toolbar.MenuAction>
            </Stack.Toolbar.Menu>
            <Stack.Toolbar.Menu
              icon={Icon.select({
                ios: "bell.fill",
                android: NotificationsSymbol,
              })}
            >
              <Stack.Toolbar.Label>Push Requests</Stack.Toolbar.Label>
              <Stack.Toolbar.MenuAction
                disabled={devMenu.tokenActionDisabled}
                icon={Icon.select({
                  ios: "bell.badge.fill",
                  android: NotificationAddSymbol,
                })}
                onPress={devMenu.spawnSamplePushRequest}
              >
                Spawn Sample
              </Stack.Toolbar.MenuAction>
              <Stack.Toolbar.MenuAction
                destructive
                icon={Icon.select({
                  ios: "clear.fill",
                  android: ClearAllSymbol,
                })}
                onPress={devMenu.clearPushRequests}
              >
                Clear
              </Stack.Toolbar.MenuAction>
            </Stack.Toolbar.Menu>
            <Stack.Toolbar.MenuAction
              icon={Icon.select({
                ios: "arrow.counterclockwise",
                android: RestartAltSymbol,
              })}
              onPress={devMenu.resetOnboarding}
            >
              Show Onboarding
            </Stack.Toolbar.MenuAction>
          </Stack.Toolbar.Menu>
        )}
        {Platform.OS === "ios" &&
          !isLiquidGlassAvailable() &&
          showToolbarAddButton &&
          toolbarAddButton}
      </Stack.Toolbar>
    </>
  );

  const footer = isLiquidGlassAvailable() ? (
    <Stack.Toolbar placement="bottom">
      <Stack.Toolbar.SearchBarSlot />
      {showToolbarAddButton && toolbarAddButton}
    </Stack.Toolbar>
  ) : null;

  const androidAddFab =
    Platform.OS === "android" ? (
      <AndroidHost matchContents style={styles.fabHost}>
        <Box modifiers={[imePadding()]}>
          <ExtendedFloatingActionButton
            expanded={tokens.length === 0}
            onClick={() => {
              router.navigate("/token/add");
            }}
          >
            <ExtendedFloatingActionButton.Icon>
              <AndroidIcon source={AddSymbol} />
            </ExtendedFloatingActionButton.Icon>
            <ExtendedFloatingActionButton.Text>
              <Text style={styles.fabText}>{t`Add token`}</Text>
            </ExtendedFloatingActionButton.Text>
          </ExtendedFloatingActionButton>
        </Box>
      </AndroidHost>
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
          {Platform.OS === "ios" && (
            <Host
              matchContents={{ vertical: true }}
              style={[styles.noTokenButton, { width: emptyStateButtonWidth }]}
            >
              <Button
                modifiers={[
                  controlSize("large"),
                  buttonStyle(
                    isLiquidGlassAvailable()
                      ? "glassProminent"
                      : "borderedProminent",
                  ),
                ]}
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
          )}
        </ThemedView>
        {androidAddFab}
        {footer}
      </>
    );
  }

  return (
    <>
      {header}
      <KeyboardAvoidingView behavior="height" style={styles.listContainer}>
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
                android: filteredTokens.length > 0 ? 100 + bottom : 0,
                default: 0,
              }),
            },
          ]}
          renderItem={renderItem}
          data={filteredTokens}
          keyExtractor={(item) => item.id}
          itemLayoutAnimation={LinearTransition}
          ListEmptyComponent={
            <Animated.View
              entering={FadeIn}
              exiting={FadeOut}
              style={styles.noResultsWrapper}
            >
              <ThemedView style={styles.noResultsContainer}>
                <ThemedView
                  type="backgroundSecondary"
                  style={styles.noResultsIcon}
                >
                  <SymbolView
                    name={{ ios: "magnifyingglass", android: "search" }}
                    size={32}
                    tintColor={theme.textSecondary}
                  />
                </ThemedView>
                <ThemedText
                  fontSize={Typography.fontSize24}
                  fontWeight="semiBold"
                  style={styles.noResultsTitle}
                >
                  <Trans>No tokens found</Trans>
                </ThemedText>
                <ThemedText
                  fontWeight="light"
                  style={styles.noResultsDescription}
                  themeColor="textSecondary"
                >
                  <Trans>
                    Try another token name, issuer, or serial number.
                  </Trans>
                </ThemedText>
                <ThemedView
                  type="backgroundSecondary"
                  style={styles.searchQueryChip}
                >
                  <ThemedText
                    fontSize={Typography.fontSize14}
                    fontWeight="semiBold"
                    numberOfLines={1}
                    selectable
                    style={styles.searchQueryText}
                  >
                    “{searchText}”
                  </ThemedText>
                </ThemedView>
              </ThemedView>
            </Animated.View>
          }
          ListHeaderComponent={
            showNotificationNotice && !searchQuery ? (
              <View style={styles.notificationNotice}>
                <StatusCard
                  variant="danger"
                  title={t`Notifications are disabled`}
                  description={t`Enable notifications to receive push approval requests on this device.`}
                />
              </View>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={isPolling}
              onRefresh={onRefresh}
              title={t`Refreshing...`}
              tintColor={refreshControlColor}
              titleColor={refreshControlColor}
              colors={[refreshControlColor]}
              progressBackgroundColor={refreshControlProgressBackgroundColor}
            />
          }
        />
      </KeyboardAvoidingView>
      {androidAddFab}
      {footer}
    </>
  );
}

export const styles = StyleSheet.create({
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
  },
  fabHost: {
    bottom: Spacing.lg,
    position: "absolute",
    right: Spacing.lg,
    zIndex: 10,
  },
  fabText: {
    fontWeight: "bold",
  },
  listContainer: {
    flex: 1,
  },
  noResultsContainer: {
    alignItems: "center",
    maxWidth: 360,
    paddingHorizontal: Spacing.xl,
  },
  noResultsDescription: {
    lineHeight: Typography.fontSize16 * 1.4,
    textAlign: "center",
  },
  noResultsIcon: {
    alignItems: "center",
    borderRadius: Radii.pill,
    height: 72,
    justifyContent: "center",
    marginBottom: Spacing.lg,
    width: 72,
  },
  noResultsTitle: {
    lineHeight: Typography.fontSize24 * 1.2,
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  noResultsWrapper: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
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
  notificationNotice: {
    marginVertical: Spacing.sm,
  },
  searchQueryChip: {
    borderRadius: Radii.pill,
    marginTop: Spacing.lg,
    maxWidth: "100%",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  searchQueryText: {
    textAlign: "center",
  },
  tokenWrapper: {
    marginVertical: Spacing.sm,
  },
});
