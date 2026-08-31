import { ThemedText } from "@/components/themed-text";
import {
  ONBOARDING_MAX_FONT_SIZE_MULTIPLIER,
  ONBOARDING_PANEL_GAP,
  ONBOARDING_STEP_COUNT,
  onboardingProgressInputRange,
  onboardingStepAccents,
} from "@/constants/onboarding";
import {
  getResponsiveScale,
  Radii,
  Spacing,
  StaticColors,
  Typography,
} from "@/constants/theme";
import { useNotificationStatus } from "@/hooks/use-notifications";
import { useTheme } from "@/hooks/use-theme";
import { useSettingsStore } from "@/stores/settings";
import type { EasingFunction, OnboardingStep } from "@/types/onboarding";
import { configureHaptics, playHaptic } from "@/utils/haptics";
import {
  isNotificationPermissionEnabled,
  isNotificationPermissionPending,
} from "@/utils/notification";
import { useLingui } from "@lingui/react/macro";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AppState,
  BackHandler,
  Linking,
  PanResponder,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProgressSegmentFill } from "./onboarding-sequence/progress-segment-fill";
import {
  CrashReportsStepActions,
  NotificationStepActions,
  WelcomeStepActions,
} from "./onboarding-sequence/step-actions";
import {
  VisualCardContent,
  WelcomeVisualContent,
} from "./onboarding-sequence/visual-content";

const BUTTON_SLIDE_EASING = Easing.inOut(Easing.cubic);
const SWIPE_SLIDE_EASING = Easing.out(Easing.cubic);
const VISUAL_CONTENT_WIDTH = 220;

export function OnboardingSequence() {
  const [stepIndex, setStepIndex] = useState(0);
  const [isCheckingPermission, setIsCheckingPermission] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const { t } = useLingui();
  const {
    checkPermissions: checkNotificationPermission,
    getFcmToken,
    hasPermission: hasNotificationPermission,
    permissionStatus: notificationPermissionStatus,
    pushCapability,
    requestPermissions: requestNotificationPermission,
  } = useNotificationStatus();
  const completeOnboarding = useSettingsStore(
    (state) => state.completeOnboarding,
  );
  const setCrashReportsEnabled = useSettingsStore(
    (state) => state.setCrashReportsEnabled,
  );
  const theme = useTheme();
  const backgroundColor = theme.background;
  const cardColor = theme.backgroundSecondary;
  const textColor = theme.text;
  const borderColor = theme.border;
  const { bottom, top } = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const usableHeight = height - top - bottom;
  const layoutScale = getResponsiveScale(width, usableHeight);
  const visualScale = Math.min(
    layoutScale,
    (width - Spacing.xl * 4) / VISUAL_CONTENT_WIDTH,
  );
  const colorScheme = (useColorScheme() ?? "light") as "light" | "dark";
  const steps = useMemo<OnboardingStep[]>(
    () => [
      {
        id: "welcome",
        kicker: t`Welcome`,
        title: t`Welcome to eduMFA`,
        body: t`Keep your authentication tokens in one place and approve sign-ins securely from this device.`,
        accent: onboardingStepAccents[0],
      },
      {
        id: "notifications",
        kicker: t`Notifications`,
        title: t`Never miss a sign-in request`,
        body: t`Get notified when a sign-in needs your approval.`,
        accent: onboardingStepAccents[1],
      },
      {
        id: "privacy",
        kicker: t`Your choice`,
        title: t`Help improve eduMFA`,
        body: t`Choose whether to share anonymous crash and error reports.`,
        accent: onboardingStepAccents[2],
      },
    ],
    [t],
  );
  const stepAccentColors = useMemo(
    () => steps.map((item) => item.accent[colorScheme]),
    [colorScheme, steps],
  );
  const logoColor =
    colorScheme === "dark" ? StaticColors.white : StaticColors.black;
  const screenProgress = useSharedValue(0);
  const shouldBlockNotificationAdvance =
    stepIndex === 1 &&
    isNotificationPermissionPending(notificationPermissionStatus);
  const slideDistance = width + ONBOARDING_PANEL_GAP;

  const goToStep = useCallback(
    (nextStepIndex: number, easing: EasingFunction = BUTTON_SLIDE_EASING) => {
      const boundedStepIndex = Math.max(
        0,
        Math.min(nextStepIndex, ONBOARDING_STEP_COUNT - 1),
      );

      setStepIndex(boundedStepIndex);
      screenProgress.set(
        withTiming(boundedStepIndex, {
          duration: 360,
          easing,
        }),
      );
    },
    [screenProgress],
  );

  const refreshNotificationStatus = useCallback(async () => {
    if (stepIndex !== 1) {
      return;
    }

    setIsCheckingPermission(true);

    try {
      await checkNotificationPermission();
      await getFcmToken();
    } finally {
      setIsCheckingPermission(false);
    }
  }, [checkNotificationPermission, getFcmToken, stepIndex]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          const isHorizontalSwipe =
            Math.abs(gestureState.dx) > Spacing.sm &&
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
          const canSwipeBack = stepIndex > 0 && gestureState.dx > 0;
          const canSwipeForward =
            stepIndex < ONBOARDING_STEP_COUNT - 1 && gestureState.dx < 0;

          return isHorizontalSwipe && (canSwipeBack || canSwipeForward);
        },
        onPanResponderMove: (_, gestureState) => {
          const dragProgress = stepIndex - gestureState.dx / slideDistance;
          const maxProgress = shouldBlockNotificationAdvance
            ? stepIndex + 0.08
            : ONBOARDING_STEP_COUNT - 1;
          const boundedDragProgress = Math.min(
            maxProgress,
            Math.max(0, dragProgress),
          );

          screenProgress.set(boundedDragProgress);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx > slideDistance * 0.25) {
            playHaptic((presets) => presets.System.impactLight());
            goToStep(stepIndex - 1, SWIPE_SLIDE_EASING);
            return;
          }

          if (gestureState.dx < -slideDistance * 0.25) {
            if (shouldBlockNotificationAdvance) {
              playHaptic((presets) => presets.System.notificationError());
              screenProgress.set(
                withTiming(stepIndex, {
                  duration: 260,
                  easing: Easing.out(Easing.back(1.4)),
                }),
              );
              return;
            }

            playHaptic((presets) => presets.System.impactMedium());
            goToStep(stepIndex + 1, SWIPE_SLIDE_EASING);
            return;
          }

          screenProgress.set(
            withTiming(stepIndex, {
              duration: 220,
              easing: SWIPE_SLIDE_EASING,
            }),
          );
        },
      }),
    [
      goToStep,
      screenProgress,
      shouldBlockNotificationAdvance,
      slideDistance,
      stepIndex,
    ],
  );

  useEffect(() => {
    configureHaptics();
  }, []);

  useEffect(() => {
    if (process.env.EXPO_OS !== "android" || stepIndex === 0) {
      return;
    }

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        playHaptic((presets) => presets.System.impactLight());
        goToStep(stepIndex - 1, SWIPE_SLIDE_EASING);
        return true;
      },
    );

    return () => {
      subscription.remove();
    };
  }, [goToStep, stepIndex]);

  useEffect(() => {
    if (stepIndex !== 1) {
      return;
    }

    const refreshTimer = setTimeout(() => {
      void refreshNotificationStatus();
    }, 0);

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState !== "active") {
        return;
      }

      void refreshNotificationStatus();
    });

    return () => {
      clearTimeout(refreshTimer);
      subscription.remove();
    };
  }, [refreshNotificationStatus, stepIndex]);

  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -screenProgress.value * slideDistance }],
  }));

  const handleContinue = useCallback(() => {
    playHaptic((presets) => presets.System.impactMedium());
    goToStep(stepIndex + 1);
  }, [goToStep, stepIndex]);

  const handleOptInCrashReports = useCallback(() => {
    playHaptic((presets) => presets.System.notificationSuccess());
    setCrashReportsEnabled(true);
    completeOnboarding();
  }, [completeOnboarding, setCrashReportsEnabled]);

  const handleDeclineCrashReports = useCallback(() => {
    playHaptic((presets) => presets.System.impactLight());
    setCrashReportsEnabled(false);
    completeOnboarding();
  }, [completeOnboarding, setCrashReportsEnabled]);

  const handleEnableNotifications = useCallback(async () => {
    setIsRequestingPermission(true);
    playHaptic((presets) => presets.System.impactHeavy());

    try {
      const result = await requestNotificationPermission();
      await getFcmToken();

      if (isNotificationPermissionEnabled(result)) {
        playHaptic((presets) => presets.System.notificationSuccess());
      } else {
        playHaptic((presets) => presets.System.notificationError());
      }
    } catch (error) {
      playHaptic((presets) => presets.System.notificationError());
      if (__DEV__) {
        console.warn("Could not enable notifications:", error);
      }
    } finally {
      setIsRequestingPermission(false);
    }
  }, [getFcmToken, requestNotificationPermission]);

  const handleOpenNotificationSettings = useCallback(() => {
    playHaptic((presets) => presets.System.impactMedium());
    Linking.openSettings().catch((error: unknown) => {
      if (__DEV__) {
        console.warn("Could not open notification settings:", error);
      }
    });
  }, []);

  const handleSkipNotifications = useCallback(() => {
    playHaptic((presets) => presets.System.impactLight());
    goToStep(2);
  }, [goToStep]);

  const renderStepActions = (contentStepIndex: number) => {
    const contentAccentColor = stepAccentColors[contentStepIndex];

    if (contentStepIndex === 1) {
      return (
        <NotificationStepActions
          accentColor={contentAccentColor}
          isCheckingPermission={isCheckingPermission}
          isRequestingPermission={isRequestingPermission}
          onContinue={handleContinue}
          onEnableNotifications={handleEnableNotifications}
          onOpenSettings={handleOpenNotificationSettings}
          onSkip={handleSkipNotifications}
          hasNotificationPermission={hasNotificationPermission}
          permissionStatus={notificationPermissionStatus}
          scale={layoutScale}
          pushCapability={pushCapability}
          textColor={textColor}
        />
      );
    }

    if (contentStepIndex === 2) {
      return (
        <CrashReportsStepActions
          accentColor={contentAccentColor}
          onDecline={handleDeclineCrashReports}
          onOptIn={handleOptInCrashReports}
          scale={layoutScale}
        />
      );
    }

    return (
      <WelcomeStepActions
        accentColor={contentAccentColor}
        label={t`Get started`}
        onContinue={handleContinue}
        scale={layoutScale}
      />
    );
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor,
          height,
          paddingBottom: bottom,
          paddingTop: top + Spacing.lg,
        },
      ]}
    >
      <View style={styles.progressWrap}>
        {steps.map((contentStep, contentStepIndex) => (
          <View
            key={contentStep.id}
            style={[styles.progressSegment, { backgroundColor: borderColor }]}
          >
            <ProgressSegmentFill
              index={contentStepIndex}
              inputRange={onboardingProgressInputRange}
              progress={screenProgress}
              stepAccentColors={stepAccentColors}
            />
          </View>
        ))}
      </View>

      <View style={styles.viewport} {...panResponder.panHandlers}>
        <Animated.View
          style={[
            styles.track,
            {
              columnGap: ONBOARDING_PANEL_GAP,
              width:
                width * ONBOARDING_STEP_COUNT +
                ONBOARDING_PANEL_GAP * (ONBOARDING_STEP_COUNT - 1),
            },
            trackStyle,
          ]}
        >
          {steps.map((contentStep, contentStepIndex) => {
            const contentAccentColor = stepAccentColors[contentStepIndex];

            return (
              <View key={contentStep.id} style={[styles.panel, { width }]}>
                <View style={styles.panelContent}>
                  <View style={styles.panelBody}>
                    <View style={styles.heroWrap}>
                      <View
                        style={[
                          styles.visualCard,
                          {
                            backgroundColor: cardColor,
                            padding: Spacing.xl,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.visualContentFrame,
                            {
                              transform: [
                                {
                                  scale: visualScale,
                                },
                              ],
                            },
                          ]}
                        >
                          {contentStepIndex === 0 ? (
                            <WelcomeVisualContent logoColor={logoColor} />
                          ) : (
                            <VisualCardContent
                              accentColor={contentAccentColor}
                              index={contentStepIndex}
                            />
                          )}
                        </View>
                      </View>
                    </View>

                    <View style={styles.copy}>
                      <ThemedText
                        fontSize={Typography.fontSize14 * layoutScale}
                        fontWeight="semiBold"
                        maxFontSizeMultiplier={
                          ONBOARDING_MAX_FONT_SIZE_MULTIPLIER
                        }
                        style={[styles.kicker, { color: contentAccentColor }]}
                      >
                        {contentStep.kicker}
                      </ThemedText>
                      <ThemedText
                        adjustsFontSizeToFit
                        fontSize={Typography.fontSize34 * layoutScale}
                        fontWeight="bold"
                        maxFontSizeMultiplier={
                          ONBOARDING_MAX_FONT_SIZE_MULTIPLIER
                        }
                        minimumFontScale={
                          Typography.fontSize28 /
                          (Typography.fontSize34 * layoutScale)
                        }
                        numberOfLines={2}
                        style={[
                          styles.title,
                          {
                            lineHeight:
                              Typography.fontSize34 * layoutScale * 1.1,
                          },
                        ]}
                      >
                        {contentStep.title}
                      </ThemedText>
                      <ThemedText
                        themeColor="textSecondary"
                        fontSize={Typography.fontSize16 * layoutScale}
                        maxFontSizeMultiplier={
                          ONBOARDING_MAX_FONT_SIZE_MULTIPLIER
                        }
                        style={[
                          styles.body,
                          {
                            lineHeight:
                              Typography.fontSize16 * layoutScale * 1.45,
                          },
                        ]}
                      >
                        {contentStep.body}
                      </ThemedText>
                    </View>
                  </View>

                  {renderStepActions(contentStepIndex)}
                </View>
              </View>
            );
          })}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    lineHeight: Typography.fontSize16 * 1.45,
    textAlign: "center",
  },
  container: {
    alignItems: "center",
    justifyContent: "space-between",
  },
  copy: {
    alignItems: "center",
    gap: Spacing.sm,
  },
  heroWrap: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    maxHeight: 160,
    minHeight: 72,
    width: "100%",
  },
  kicker: {
    letterSpacing: 0,
    textAlign: "center",
    textTransform: "uppercase",
  },
  panel: {
    alignItems: "center",
    justifyContent: "center",
  },
  panelBody: {
    alignItems: "center",
    flex: 1,
    gap: Spacing.md,
    justifyContent: "center",
    minHeight: 0,
    width: "100%",
  },
  panelContent: {
    alignSelf: "center",
    flex: 1,
    gap: Spacing.md,
    justifyContent: "space-between",
    maxWidth: 520,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    width: "100%",
  },
  progressSegment: {
    borderRadius: Radii.sm,
    flex: 1,
    height: 4,
    overflow: "hidden",
  },
  progressWrap: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    width: "100%",
  },
  title: {
    lineHeight: Typography.fontSize34 * 1.1,
    textAlign: "center",
  },
  track: {
    flex: 1,
    flexDirection: "row",
  },
  viewport: {
    flex: 1,
    overflow: "hidden",
    width: "100%",
  },
  visualCard: {
    alignItems: "center",
    borderCurve: "continuous",
    borderRadius: Radii.md,
    flex: 1,
    justifyContent: "center",
    width: "100%",
  },
  visualContentFrame: {
    alignItems: "center",
    justifyContent: "center",
  },
});
