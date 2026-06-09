import { NotificationHandler } from "@/components/notification-handler";
import { TokenDetails } from "@/components/token-details";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Radii, Spacing, StaticColors, Typography } from "@/constants/theme";
import { useChallengePolling } from "@/hooks/use-challenge-polling";
import { useDeleteTokenConfirmation } from "@/hooks/use-delete-token-confirmation";
import { useToken } from "@/hooks/use-token";
import { useTheme } from "@/hooks/use-theme";
import { usePushRequestStore } from "@/store/push-request-store";
import { PushToken, PushTokenRolloutState } from "@/types";
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
  const { tokens, updateToken, rolloutToken } = useToken();
  const confirmDeleteToken = useDeleteTokenConfirmation();
  const { isPolling, pollChallenges } = useChallengePolling();
  const { clearPushRequests } = usePushRequestStore();
  const { height } = useWindowDimensions();
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
                <TokenDetails token={item} key={item.id} />
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
      <Stack.Header style={stackHeaderStyle} />
      <Stack.Toolbar placement="right">
        {__DEV__ && (
          <Stack.Toolbar.Menu>
            <Stack.Toolbar.Label>DEV</Stack.Toolbar.Label>
            <Stack.Toolbar.MenuAction
              onPress={() => {
                rolloutToken(tokens[0].id);
              }}
            >
              Rollout
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction
              onPress={() => {
                updateToken(tokens[0].id, {
                  rolloutState: PushTokenRolloutState.Pending,
                });
                setTimeout(() => {
                  updateToken(tokens[0].id, {
                    rolloutState: PushTokenRolloutState.RSAKeyGeneration,
                  });
                }, 1000);
                setTimeout(() => {
                  updateToken(tokens[0].id, {
                    rolloutState: PushTokenRolloutState.SendRSAPublicKey,
                  });
                }, 2000);
                setTimeout(() => {
                  updateToken(tokens[0].id, {
                    rolloutState: PushTokenRolloutState.SendRSAPublicKeyFailed,
                  });
                }, 4000);
              }}
            >
              Demo Rollout Failure
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction
              onPress={() => {
                updateToken(tokens[0].id, {
                  rolloutState: PushTokenRolloutState.Pending,
                });
                setTimeout(() => {
                  updateToken(tokens[0].id, {
                    rolloutState: PushTokenRolloutState.RSAKeyGeneration,
                  });
                }, 1000);
                setTimeout(() => {
                  updateToken(tokens[0].id, {
                    rolloutState: PushTokenRolloutState.SendRSAPublicKey,
                  });
                }, 2000);
                setTimeout(() => {
                  updateToken(tokens[0].id, {
                    rolloutState: PushTokenRolloutState.ParsingResponse,
                  });
                }, 4000);
                setTimeout(() => {
                  updateToken(tokens[0].id, {
                    rolloutState: PushTokenRolloutState.Completed,
                  });
                }, 5000);
              }}
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
        )}
        {Platform.OS === "ios" && !isLiquidGlassAvailable() && toolbarAddButton}
      </Stack.Toolbar>
    </>
  );

  const footer = isLiquidGlassAvailable() ? (
    <Stack.Toolbar placement="bottom">
      <Stack.Toolbar.SearchBarSlot />
      {toolbarAddButton}
    </Stack.Toolbar>
  ) : null;

  if (!tokens.length) {
    return (
      <>
        {header}
        <ThemedView style={styles.noTokenContainer}>
          <ThemedText fontSize={Typography.fontSize20} fontWeight="medium">
            <Trans>No Token setup</Trans>
          </ThemedText>
          <ThemedView style={styles.noTokenHintContent}>
            <ThemedText
              fontSize={Typography.fontSize16}
              fontWeight="light"
              style={styles.noTokenHint}
            >
              <Trans>Tap the</Trans>
            </ThemedText>
            <SymbolView
              name={{ ios: "plus", android: "add" }}
              size={16}
              style={styles.noTokenHintIcon}
            />
            <ThemedText
              fontSize={Typography.fontSize16}
              fontWeight="light"
              style={styles.noTokenHint}
            >
              <Trans>to get started.</Trans>
            </ThemedText>
          </ThemedView>
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
  noTokenContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  noTokenHint: {
    lineHeight: Typography.fontSize16 * 1.2,
  },
  noTokenHintContent: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  noTokenHintIcon: {
    alignSelf: "center",
  },
  tokenCard: {
    borderRadius: Radii.xl,
    overflow: "hidden",
  },
  tokenWrapper: {
    marginVertical: Spacing.sm,
  },
});
