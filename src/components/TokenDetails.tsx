import { theme } from "@/theme";
import { PushToken, PushTokenRolloutState } from "@/types";
import { BlurView } from "expo-blur";
import { memo, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

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
import { ThemedText, ThemedView, useThemeColor } from "./Themed";
import { TokenImage } from "./TokenImage";

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

export const TokenDetails = memo(function TokenDetails({
  token,
}: {
  token: PushToken;
}) {
  const { t } = useLingui();
  const backgroundColor = useThemeColor(theme.color.backgroundSecondary);
  const successBarColor = useThemeColor(theme.color.successBar);
  const errorBarColor = useThemeColor(theme.color.errorBar);

  // Derive initial states from token
  const isCompleted = token.rolloutState === PushTokenRolloutState.Completed;
  const isRolloutFailed = PushTokenRolloutState.isFailed(token.rolloutState);

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
      <ThemedView style={tokenContainerStyle}>
        {token.imageUrl && (
          <TokenImage imageUrl={token.imageUrl} animated size="small" />
        )}
        <View style={styles.tokenDetails}>
          <ThemedText fontSize={theme.fontSize16}>{token.label}</ThemedText>
          {token.issuer && (
            <ThemedText
              fontSize={theme.fontSize14}
              fontWeight="medium"
              color={theme.color.textSecondary}
            >
              {token.issuer}
            </ThemedText>
          )}
        </View>
      </ThemedView>
      {showProgress && (
        <AnimatedBlurView
          style={styles.progressBarBlur}
          role="progressbar"
          intensity={20}
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
    </>
  );
});

const styles = StyleSheet.create({
  progressBar: {
    flex: 1,
  },
  progressBarBlur: {
    borderRadius: theme.borderRadius32,
    height: "100%",
    position: "absolute",
    width: "100%",
  },
  progressText: {
    alignSelf: "center",
    fontWeight: "bold",
    position: "absolute",
    top: theme.space24,
    zIndex: 2,
  },
  token: {
    alignItems: "center",
    flexDirection: "row",
    height: 70,
    padding: theme.space12,
  },
  tokenDetails: {
    flex: 1,
    gap: theme.space2,
    justifyContent: "center",
  },
});
