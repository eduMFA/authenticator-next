import { ThemedText } from "@/components/themed-text";
import {
  ONBOARDING_PANEL_GAP,
  ONBOARDING_STEP_COUNT,
  onboardingProgressInputRange,
  onboardingStepAccents,
} from "@/constants/onboarding";
import { Radii, Spacing, StaticColors, Typography } from "@/constants/theme";
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
  Linking,
  PanResponder,
  ScrollView,
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
  const colorScheme = (useColorScheme() ?? "light") as "light" | "dark";
  const steps = useMemo<OnboardingStep[]>(
    () => [
      {
        id: "welcome",
        kicker: t`Welcome`,
        title: t`Welcome to eduMFA`,
        body: t`Approve sign-ins securely from this device, with your eduMFA tokens ready when you need them.`,
        accent: onboardingStepAccents[0],
      },
      {
        id: "notifications",
        kicker: t`Notifications`,
        title: t`Approve sign-ins the moment they arrive`,
        body: t`Notifications are important for eduMFA. They let the app receive sign-in approvals and tell you when a push request needs your attention.`,
        accent: onboardingStepAccents[1],
      },
      {
        id: "privacy",
        kicker: t`Privacy choice`,
        title: t`Help improve reliability`,
        body: t`You can opt in to anonymized crash and error reports. This is off by default, and the app works the same either way.`,
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
        />
      );
    }

    return (
      <WelcomeStepActions
        accentColor={contentAccentColor}
        label={t`Get started`}
        onContinue={handleContinue}
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
          paddingTop: top + Spacing.xl,
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
                  <ScrollView
                    bounces={false}
                    contentContainerStyle={styles.panelBody}
                    showsVerticalScrollIndicator={false}
                    style={styles.panelBodyScroll}
                  >
                    <View style={styles.heroWrap}>
                      <View
                        style={[
                          styles.visualCard,
                          contentStepIndex === 0 && styles.welcomeVisualCard,
                          {
                            backgroundColor: cardColor,
                            borderColor,
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

                    <View style={styles.copy}>
                      <ThemedText
                        fontSize={Typography.fontSize14}
                        fontWeight="semiBold"
                        style={[styles.kicker, { color: contentAccentColor }]}
                      >
                        {contentStep.kicker}
                      </ThemedText>
                      <ThemedText
                        fontSize={Typography.fontSize34}
                        fontWeight="bold"
                        style={styles.title}
                      >
                        {contentStep.title}
                      </ThemedText>
                      <ThemedText
                        themeColor="textSecondary"
                        fontSize={Typography.fontSize16}
                        style={styles.body}
                      >
                        {contentStep.body}
                      </ThemedText>
                    </View>
                  </ScrollView>

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
    gap: Spacing.md,
  },
  heroWrap: {
    alignItems: "center",
    height: 188,
    justifyContent: "center",
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
    flexGrow: 1,
    gap: Spacing.xl,
    justifyContent: "center",
    width: "100%",
  },
  panelBodyScroll: {
    flex: 1,
    width: "100%",
  },
  panelContent: {
    alignItems: "center",
    flex: 1,
    gap: Spacing.xl,
    justifyContent: "space-between",
    maxWidth: 520,
    paddingHorizontal: Spacing.xl,
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
    borderWidth: 1,
    height: 172,
    justifyContent: "center",
    padding: Spacing.lg,
    width: "100%",
  },
  welcomeVisualCard: {
    borderWidth: 0,
    paddingVertical: Spacing.sm,
  },
});
