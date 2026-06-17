import {
  PushToken,
  PushTokenRefreshStatus,
  PushTokenRolloutState,
} from "@/types";
import { BlurTargetView, BlurView } from "expo-blur";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";

import { Radii, Spacing, Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useLingui } from "@lingui/react/macro";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  TOKEN_ACTION_MENU_WIDTH,
  TokenActionsMenu,
  type TokenAction,
} from "./TokenActionsMenu";
import { ThemedText } from "./themed-text";
import { TokenImage } from "./token-image";

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

// Animation timing configuration
const PROGRESS_ANIMATION_DURATION = 500;
const FAILED_ANIMATION_DURATION = 1000;
const PROGRESS_HIDE_DELAY = 1000;

const timingConfig = {
  progress: {
    easing: Easing.inOut(Easing.quad),
    duration: PROGRESS_ANIMATION_DURATION,
  },
  failed: {
    easing: Easing.inOut(Easing.quad),
    duration: FAILED_ANIMATION_DURATION,
  },
} as const;

export const TokenListItem = memo(function TokenListItem({
  actions,
  token,
}: {
  actions: TokenAction[];
  token: PushToken;
}) {
  const { t } = useLingui();
  const theme = useTheme();
  const backgroundColor = theme.backgroundSecondary;
  const successBarColor = theme.successBar;
  const errorBarColor = theme.errorBar;
  const blurTargetRef = useRef<View | null>(null);

  // Derive initial states from token
  const isCompleted = token.rolloutState === PushTokenRolloutState.Completed;
  const isRolloutFailed = PushTokenRolloutState.isFailed(token.rolloutState);
  const isRolloutFinished = PushTokenRolloutState.isFinished(
    token.rolloutState,
  );
  const showActionsMenu = Platform.OS === "android" && isRolloutFinished;
  const isRefreshFailed =
    token.lastRefreshResult?.status === PushTokenRefreshStatus.Failed;

  const [showProgress, setShowProgress] = useState(!isCompleted);

  // Shared values for animations
  const progress = useSharedValue(
    PushTokenRolloutState.getProgress(token.rolloutState),
  );
  const isFailed = useSharedValue(Number(isRolloutFailed));

  // Animated styles for progress bar
  const animatedStyles = useAnimatedStyle(() => ({
    width: `${progress.value}%`,
    backgroundColor: interpolateColor(
      isFailed.value,
      [0, 1],
      [successBarColor, errorBarColor],
    ),
  }));

  // Memoized container style to avoid recreation on each render
  const tokenContainerStyle = useMemo(
    () => [styles.token, { backgroundColor }],
    [backgroundColor],
  );
  const tokenDetailsStyle = useMemo(
    () => [
      styles.tokenDetails,
      showActionsMenu && styles.tokenDetailsWithActionMenu,
    ],
    [showActionsMenu],
  );

  useEffect(() => {
    const targetProgress = PushTokenRolloutState.getProgress(
      token.rolloutState,
    );
    const targetFailed = Number(
      PushTokenRolloutState.isFailed(token.rolloutState),
    );

    progress.value = withTiming(targetProgress, timingConfig.progress);
    isFailed.value = withTiming(targetFailed, timingConfig.failed);

    if (token.rolloutState === PushTokenRolloutState.Completed) {
      const timer = setTimeout(
        () => setShowProgress(false),
        PROGRESS_HIDE_DELAY,
      );
      return () => clearTimeout(timer);
    }

    setShowProgress(true);
  }, [token.rolloutState, progress, isFailed]);

  // Progress text based on rollout state
  const progressText = isRolloutFailed ? t`Rollout Failed` : t`Rolling out...`;

  return (
    <>
      <BlurTargetView ref={blurTargetRef} style={tokenContainerStyle}>
        <TokenImage
          imageUrl={token.imageUrl}
          label={token.label}
          animated
          size="small"
        />
        <View style={tokenDetailsStyle}>
          <View style={styles.titleRow}>
            <ThemedText
              fontSize={Typography.fontSize16}
              numberOfLines={1}
              style={styles.tokenLabel}
            >
              {token.label}
            </ThemedText>
            {isRefreshFailed ? (
              <View
                accessibilityLabel={t`Refresh failed`}
                style={[
                  styles.refreshBadge,
                  { backgroundColor: errorBarColor },
                ]}
              >
                <ThemedText
                  themeColor="text"
                  fontSize={Typography.fontSize10}
                  fontWeight="bold"
                >
                  !
                </ThemedText>
              </View>
            ) : null}
          </View>
          {token.issuer && (
            <ThemedText
              fontSize={Typography.fontSize14}
              fontWeight="medium"
              themeColor="textSecondary"
            >
              {token.issuer}
            </ThemedText>
          )}
        </View>
      </BlurTargetView>
      {showProgress && (
        <AnimatedBlurView
          style={styles.progressBarBlur}
          role="progressbar"
          intensity={20}
          blurTarget={blurTargetRef}
          blurMethod={"dimezisBlurView"}
          entering={FadeIn}
          exiting={FadeOut}
        >
          <Animated.View
            style={[styles.progressBar, animatedStyles]}
            exiting={FadeOut}
          />
          <ThemedText style={styles.progressText}>{progressText}</ThemedText>
        </AnimatedBlurView>
      )}
      {showActionsMenu && <TokenActionsMenu actions={actions} />}
    </>
  );
});

const styles = StyleSheet.create({
  progressBar: {
    flex: 1,
  },
  progressBarBlur: {
    borderRadius: Radii.pill,
    height: "100%",
    position: "absolute",
    width: "100%",
  },
  progressText: {
    alignSelf: "center",
    fontWeight: "bold",
    position: "absolute",
    top: Spacing.xl,
    zIndex: 2,
  },
  refreshBadge: {
    alignItems: "center",
    borderRadius: Radii.md,
    height: 18,
    justifyContent: "center",
    marginLeft: Spacing.xs,
    width: 18,
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
  },
  token: {
    alignItems: "center",
    flexDirection: "row",
    height: 70,
    padding: Spacing.md,
  },
  tokenDetails: {
    flex: 1,
    gap: Spacing.xxs,
    justifyContent: "center",
  },
  tokenDetailsWithActionMenu: {
    paddingRight: TOKEN_ACTION_MENU_WIDTH,
  },
  tokenLabel: {
    flexShrink: 1,
  },
});
