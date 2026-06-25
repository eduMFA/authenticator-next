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
import {
  getRefreshHapticPullProgress,
  getRefreshHapticRipple,
  getRefreshHapticRippleIndex,
  playImpactSoftHaptic,
} from "@/utils/haptics";
import AddSymbol from "@expo/material-symbols/add.xml";
import CodeSymbol from "@expo/material-symbols/code.xml";
import { Button, Text as ExpoText, Host, Icon, Row } from "@expo/ui";
import { buttonStyle, controlSize } from "@expo/ui/swift-ui/modifiers";
import { Trans, useLingui } from "@lingui/react/macro";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Link, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useMemo, useState } from "react";
import {
  Keyboard,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  useColorScheme,
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
  const devMenu = useDevMenu();
  const confirmDeleteToken = useDeleteTokenConfirmation();
  const { isPolling, pollChallenges } = useChallengePolling();
  const {
    hasPermission: hasNotificationPermission,
    isInitialized: isNotificationInitialized,
  } = useNotificationStatus();
  const [isManualRefreshPolling, setIsManualRefreshPolling] = useState(false);
  const { height, width } = useWindowDimensions();
  const { bottom, top } = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = useTheme();
  const refreshHaptics = useRealtimeComposer();
  const didPopRefreshHaptic = useSharedValue(false);
  const isRefreshPullActive = useSharedValue(false);
  const refreshPullStartOffset = useSharedValue(0);
  const refreshHapticRippleIndex = useSharedValue(-1);
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
                  onPress={() => {
                    router.push({
                      pathname: "/token/[tokenId]",
                      params: { edit: "1", tokenId: item.id },
                    });
                  }}
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
    [confirmDeleteToken, rolloutToken, router, t],
  );

  const toolbarAddButton = (
    <Stack.Toolbar.Button
      icon="plus"
      variant="prominent"
      onPress={handleOpenAddToken}
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
            <Stack.Toolbar.MenuAction onPress={devMenu.resetOnboarding}>
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
        </ThemedView>
        {footer}
      </>
    );
  }

  return (
    <>
      {header}
      <Animated.FlatList
        scrollToOverflowEnabled
        contentInsetAdjustmentBehavior="automatic"
        onScroll={onRefreshScroll}
        onScrollBeginDrag={dismissKeyboard}
        scrollEventThrottle={16}
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
        ListHeaderComponent={
          showNotificationNotice ? (
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
            refreshing={isPolling || isManualRefreshPolling}
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
  notificationNotice: {
    marginVertical: Spacing.sm,
  },
  tokenCard: {
    borderRadius: Radii.xl,
    overflow: "hidden",
  },
  tokenWrapper: {
    marginVertical: Spacing.sm,
  },
});
