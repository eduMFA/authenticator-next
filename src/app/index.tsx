import {
  AndroidTokenSearchBar,
  type AndroidTokenSearchBarHandle,
} from "@/components/android-token-search-bar";
import { AndroidDevMenuSheet } from "@/components/android-dev-menu-sheet";
import { StatusCard } from "@/components/status-card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { TokenListItem } from "@/components/token-list-item";
import { refreshHapticAbortDistance } from "@/constants/haptics";
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
import type { DevMenuSection } from "@/types/dev-menu";
import {
  getRefreshHapticPullProgress,
  getRefreshHapticRipple,
  getRefreshHapticRippleIndex,
  playImpactSoftHaptic,
} from "@/utils/haptics";
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
import SettingsSymbol from "@expo/material-symbols/settings.xml";
import SyncSymbol from "@expo/material-symbols/sync.xml";
import { Button, Text as ExpoText, Host, Icon, Row } from "@expo/ui";
import {
  Host as AndroidHost,
  Icon as AndroidIcon,
  Box,
  ExtendedFloatingActionButton,
  Text,
} from "@expo/ui/jetpack-compose";
import { imePadding, padding } from "@expo/ui/jetpack-compose/modifiers";
import { buttonStyle, controlSize } from "@expo/ui/swift-ui/modifiers";
import { Trans, useLingui } from "@lingui/react/macro";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import * as Linking from "expo-linking";
import {
  Stack,
  useIsFocused,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useRealtimeComposer } from "react-native-pulsar";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function Tokens() {
  const router = useRouter();
  const { tokens, rolloutToken } = useToken();
  const isScreenFocused = useIsFocused();
  const devMenu = useDevMenu();
  const confirmDeleteToken = useDeleteTokenConfirmation();
  const { isPolling, pollChallenges } = useChallengePolling();
  const {
    hasPermission: hasNotificationPermission,
    isInitialized: isNotificationInitialized,
    pushCapability,
  } = useNotificationStatus();
  const [isManualRefreshPolling, setIsManualRefreshPolling] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isAndroidDevMenuVisible, setIsAndroidDevMenuVisible] = useState(false);
  const { width } = useWindowDimensions();
  const { bottom, top } = useSafeAreaInsets();
  const theme = useTheme();
  const refreshHaptics = useRealtimeComposer();
  const didPopRefreshHaptic = useSharedValue(false);
  const isRefreshPullActive = useSharedValue(false);
  const refreshPullStartOffset = useSharedValue(0);
  const refreshHapticRippleIndex = useSharedValue(-1);
  const androidSearchBarRef = useRef<AndroidTokenSearchBarHandle>(null);
  const backgroundColor = theme.background;
  const { t } = useLingui();
  const tabBarTintColor = theme.text;
  const transparentColor = theme.transparent;
  const tabBarBackgroundColor = theme.background;
  const refreshControlColor =
    Platform.OS === "android" ? theme.branding : theme.text;
  const refreshControlProgressBackgroundColor =
    Platform.OS === "android" ? theme.backgroundSecondary : undefined;

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }

    const showSubscription = Keyboard.addListener("keyboardDidShow", () => {
      setIsKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const params = useLocalSearchParams<{ q?: string }>();

  const searchText = params?.q?.trim() || "";
  const searchQuery = searchText.toLowerCase();
  const emptyStateButtonWidth = Math.min(320, width - Spacing.xl * 2);
  const showToolbarAddButton = tokens.length > 0;
  const showNotificationNotice =
    isNotificationInitialized &&
    (!hasNotificationPermission ||
      pushCapability === "google-play-services-unavailable");
  const handleOpenNotificationSettings = useCallback(() => {
    Linking.openSettings().catch((error: unknown) => {
      if (__DEV__) {
        console.warn("Could not open notification settings:", error);
      }
    });
  }, []);
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
    androidSearchBarRef.current?.blur();
    Keyboard.dismiss();
  };

  const handleOpenAddToken = useCallback(() => {
    playImpactSoftHaptic();
    router.navigate("/token/add");
  }, [router]);

  const onRefresh = useCallback(() => {
    if (isPolling || tokens.length === 0) {
      return;
    }

    refreshHaptics.stop();
    refreshHaptics.playDiscrete(1, 1);
    setIsManualRefreshPolling(true);

    pollChallenges().finally(() => {
      setIsManualRefreshPolling(false);
    });
  }, [isPolling, pollChallenges, refreshHaptics, tokens.length]);

  const onRefreshScroll = useAnimatedScrollHandler({
    onBeginDrag: (event) => {
      refreshPullStartOffset.value = event.contentOffset.y;
      isRefreshPullActive.value = event.contentOffset.y <= 0;
      didPopRefreshHaptic.value = false;
      refreshHapticRippleIndex.value = -1;
    },
    onEndDrag: (event) => {
      const pullDistance = Math.max(
        refreshPullStartOffset.value - event.contentOffset.y,
        0,
      );
      const shouldPlayAbortHaptic =
        isRefreshPullActive.value &&
        !didPopRefreshHaptic.value &&
        pullDistance >= refreshHapticAbortDistance;

      refreshHaptics.stop();

      if (shouldPlayAbortHaptic) {
        refreshHaptics.playDiscrete(0.18, 0.75);
      }

      isRefreshPullActive.value = false;
      didPopRefreshHaptic.value = false;
      refreshHapticRippleIndex.value = -1;
    },
    onMomentumEnd: () => {
      refreshHaptics.stop();
      isRefreshPullActive.value = false;
      didPopRefreshHaptic.value = false;
      refreshHapticRippleIndex.value = -1;
    },
    onScroll: (event) => {
      if (!isRefreshPullActive.value) {
        return;
      }

      const pullDistance = Math.max(
        refreshPullStartOffset.value - event.contentOffset.y,
        0,
      );

      if (pullDistance <= 0) {
        refreshHaptics.stop();
        didPopRefreshHaptic.value = false;
        refreshHapticRippleIndex.value = -1;
        return;
      }

      const pullProgress = getRefreshHapticPullProgress(pullDistance);

      if (pullProgress >= 1 && !didPopRefreshHaptic.value) {
        refreshHaptics.stop();
        didPopRefreshHaptic.value = true;
        return;
      }

      if (pullProgress < 1) {
        didPopRefreshHaptic.value = false;
        const rippleIndex = getRefreshHapticRippleIndex(pullDistance);

        if (rippleIndex !== refreshHapticRippleIndex.value) {
          const ripple = getRefreshHapticRipple(
            rippleIndex,
            refreshHapticRippleIndex.value,
          );

          refreshHaptics.playDiscrete(ripple.amplitude, ripple.frequency);
          refreshHapticRippleIndex.value = rippleIndex;
        }
      }
    },
  });

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
      onPress={handleOpenAddToken}
    />
  );

  const devMenuSections: DevMenuSection[] = [
    {
      actions: [
        {
          androidIcon: PlayArrowSymbol,
          disabled: devMenu.tokenActionDisabled,
          iosIcon: "play.fill",
          key: "rollout-start",
          label: "Start",
          onPress: devMenu.rolloutFirstToken,
        },
        {
          androidIcon: CheckCircleSymbol,
          disabled: devMenu.tokenActionDisabled,
          iosIcon: "checkmark.circle.fill",
          key: "rollout-success",
          label: "Demo Success",
          onPress: devMenu.demoRolloutSuccess,
        },
        {
          androidIcon: CancelSymbol,
          disabled: devMenu.tokenActionDisabled,
          iosIcon: "xmark.circle.fill",
          key: "rollout-failure",
          label: "Demo Failure",
          onPress: devMenu.demoRolloutFailure,
        },
      ],
      androidIcon: SyncSymbol,
      iosIcon: "arrow.trianglehead.2.clockwise.rotate.90",
      key: "rollout",
      title: "Rollout",
    },
    {
      actions: [
        {
          androidIcon: AddCircleSymbol,
          iosIcon: "plus.circle.fill",
          key: "tokens-spawn-3",
          label: "Spawn Sample 3",
          onPress: () => devMenu.spawnSampleTokens(3),
        },
        {
          androidIcon: AddCircleSymbol,
          iosIcon: "plus.circle.fill",
          key: "tokens-spawn-10",
          label: "Spawn Sample 10",
          onPress: () => devMenu.spawnSampleTokens(10),
        },
        {
          androidIcon: DeleteSymbol,
          destructive: true,
          disabled: devMenu.tokenActionDisabled,
          iosIcon: "trash.fill",
          key: "tokens-clear",
          label: "Clear",
          onPress: devMenu.clearAllTokens,
        },
      ],
      androidIcon: KeySymbol,
      iosIcon: "key.fill",
      key: "tokens",
      title: "Tokens",
    },
    {
      actions: [
        {
          androidIcon: NotificationAddSymbol,
          disabled: devMenu.tokenActionDisabled,
          iosIcon: "bell.badge.fill",
          key: "push-spawn",
          label: "Spawn Sample",
          onPress: devMenu.spawnSamplePushRequest,
        },
        {
          androidIcon: ClearAllSymbol,
          destructive: true,
          iosIcon: "clear.fill",
          key: "push-clear",
          label: "Clear",
          onPress: devMenu.clearPushRequests,
        },
      ],
      androidIcon: NotificationsSymbol,
      iosIcon: "bell.fill",
      key: "push-requests",
      title: "Push Requests",
    },
    {
      actions: [
        {
          androidIcon: RestartAltSymbol,
          iosIcon: "arrow.counterclockwise",
          key: "onboarding-reset",
          label: "Show Onboarding",
          onPress: devMenu.resetOnboarding,
        },
      ],
      androidIcon: CodeSymbol,
      iosIcon: "hammer.fill",
      key: "app",
      title: "App",
    },
  ];

  const iosHeader = (
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
        <Stack.Toolbar.Button
          icon={Icon.select({
            ios: "gearshape",
            android: SettingsSymbol,
          })}
          onPress={() => {
            router.navigate("/settings");
          }}
        />
        {__DEV__ && (
          <Stack.Toolbar.Menu
            icon={Icon.select({
              ios: "hammer.fill",
              android: CodeSymbol,
            })}
          >
            <Stack.Toolbar.Label>DEV</Stack.Toolbar.Label>
            {devMenuSections.map((section) => (
              <Stack.Toolbar.Menu icon={section.iosIcon} key={section.key}>
                <Stack.Toolbar.Label>{section.title}</Stack.Toolbar.Label>
                {section.actions.map((action) => (
                  <Stack.Toolbar.MenuAction
                    destructive={action.destructive}
                    disabled={action.disabled}
                    icon={action.iosIcon}
                    key={action.key}
                    onPress={action.onPress}
                  >
                    {action.label}
                  </Stack.Toolbar.MenuAction>
                ))}
              </Stack.Toolbar.Menu>
            ))}
          </Stack.Toolbar.Menu>
        )}
        {Platform.OS === "ios" &&
          !isLiquidGlassAvailable() &&
          showToolbarAddButton &&
          toolbarAddButton}
      </Stack.Toolbar>
    </>
  );

  const header =
    Platform.OS === "android" ? (
      <View
        style={[
          styles.androidSearchHeader,
          { backgroundColor, paddingTop: top + Spacing.sm },
        ]}
      >
        <AndroidTokenSearchBar
          ref={androidSearchBarRef}
          query={searchText}
          placeholder={t`Search tokens`}
          onDevMenuPress={
            __DEV__
              ? () => {
                  dismissKeyboard();
                  setIsAndroidDevMenuVisible(true);
                }
              : undefined
          }
          onSettingsPress={() => {
            dismissKeyboard();
            router.navigate("/settings");
          }}
          onQueryChange={(query) => {
            router.setParams({ q: query });
          }}
        />
      </View>
    ) : (
      iosHeader
    );

  const footer = isLiquidGlassAvailable() ? (
    <Stack.Toolbar placement="bottom">
      <Stack.Toolbar.SearchBarSlot />
      {showToolbarAddButton && toolbarAddButton}
    </Stack.Toolbar>
  ) : null;

  const androidDevMenuSheet =
    Platform.OS === "android" && __DEV__ ? (
      <AndroidDevMenuSheet
        sections={devMenuSections}
        visible={isAndroidDevMenuVisible}
        onDismissRequest={() => {
          setIsAndroidDevMenuVisible(false);
        }}
      />
    ) : null;

  const shouldAvoidBottomInset = isKeyboardVisible && Keyboard.isVisible();
  const usesLegacyAndroidInsets =
    Platform.OS === "android" &&
    typeof Platform.Version === "number" &&
    Platform.Version < 29;
  const fabSpacing =
    shouldAvoidBottomInset && usesLegacyAndroidInsets ? Spacing.xl : Spacing.lg;
  const androidFabHostStyle = [
    styles.fabHost,
    { bottom: shouldAvoidBottomInset ? 0 : bottom },
  ];

  const androidAddFab =
    Platform.OS === "android" && isScreenFocused ? (
      <AndroidHost matchContents style={androidFabHostStyle}>
        <Box modifiers={[imePadding(), padding(0, 0, 0, fabSpacing)]}>
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
        <ThemedView
          onTouchStart={dismissKeyboard}
          style={styles.noTokenContainer}
        >
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
                onPress={handleOpenAddToken}
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
        {androidDevMenuSheet}
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
          onScroll={onRefreshScroll}
          onScrollBeginDrag={dismissKeyboard}
          onTouchStart={dismissKeyboard}
          scrollEventThrottle={16}
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
                <Pressable
                  disabled={
                    pushCapability === "google-play-services-unavailable"
                  }
                  onPress={handleOpenNotificationSettings}
                >
                  <StatusCard
                    variant="danger"
                    title={
                      pushCapability === "google-play-services-unavailable"
                        ? t`Pull to refresh for requests`
                        : t`Notifications are disabled`
                    }
                    description={
                      pushCapability === "google-play-services-unavailable"
                        ? t`Google Play services are unavailable, so requests cannot arrive automatically. Pull down on the token list to check for pending requests.`
                        : t`Enable notifications to receive push approval requests on this device.`
                    }
                    icon={
                      pushCapability === "google-play-services-unavailable"
                        ? { ios: "arrow.down.circle.fill", android: "refresh" }
                        : undefined
                    }
                  />
                </Pressable>
              </View>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={isPolling || isManualRefreshPolling}
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
      {androidDevMenuSheet}
      {footer}
    </>
  );
}

export const styles = StyleSheet.create({
  androidSearchHeader: {
    paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
  },
  fabHost: {
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
