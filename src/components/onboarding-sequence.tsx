import { StatusCard } from "@/components/status-card";
import { ThemedText } from "@/components/themed-text";
import { Radii, Spacing, StaticColors, Typography } from "@/constants/theme";
import { useNotificationStatus } from "@/hooks/use-notifications";
import { useTheme } from "@/hooks/use-theme";
import { useSettingsStore } from "@/store/settings-store";
import { isNotificationPermissionEnabled } from "@/utils/notification";
import { useLingui } from "@lingui/react/macro";
import { Image } from "expo-image";
import * as Notifications from "expo-notifications";
import { SymbolView } from "expo-symbols";
import type { ComponentProps } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  PanResponder,
  Pressable,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  View,
  type ColorValue,
} from "react-native";
import { Presets, Settings } from "react-native-pulsar";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const PANEL_GAP = Spacing.xl * 3;
const BUTTON_SLIDE_EASING = Easing.inOut(Easing.cubic);
const SWIPE_SLIDE_EASING = Easing.out(Easing.cubic);
const logoSource = require("../../assets/app-icons/edumfa.icon/Assets/logo.svg");

type IconName = ComponentProps<typeof SymbolView>["name"];
type EasingFunction = (value: number) => number;

type OnboardingStep = {
  accent: { light: string; dark: string };
  body: string;
  id: "welcome" | "notifications" | "privacy";
  kicker: string;
  title: string;
};

const stepAccents: OnboardingStep["accent"][] = [
  { light: "#0066FF", dark: "#58A6FF" },
  { light: "#0F9F6E", dark: "#47D7A0" },
  { light: "#8A5CF6", dark: "#B49AFF" },
];

const STEP_COUNT = stepAccents.length;
const progressInputRange = stepAccents.map((_, index) => index);

function configurePulsar() {
  try {
    Settings.enableCache(true);
    Settings.preloadPresets(["bloom", "snap", "feather", "fanfare"]);
  } catch (error) {
    if (__DEV__) {
      console.warn("Pulsar haptic setup is unavailable:", error);
    }
  }
}

function playHaptic(selectPreset: (presets: typeof Presets) => void) {
  try {
    selectPreset(Presets);
  } catch (error) {
    if (__DEV__) {
      console.warn("Pulsar haptic feedback is unavailable:", error);
    }
  }
}

function isNotificationPermissionPending(
  status: Notifications.NotificationPermissionsStatus | null,
) {
  return (
    status === null ||
    status.status === Notifications.PermissionStatus.UNDETERMINED
  );
}

export function OnboardingSequence() {
  const [stepIndex, setStepIndex] = useState(0);
  const [crashReportsEnabled, setLocalCrashReportsEnabled] = useState(false);
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
        body: t`Keep your sign-ins close at hand with push approvals and tokens that feel simple to manage.`,
        accent: stepAccents[0],
      },
      {
        id: "notifications",
        kicker: t`Notifications`,
        title: t`Approve sign-ins the moment they arrive`,
        body: t`Notifications are important for eduMFA. They let the app receive sign-in approvals and tell you when a push request needs your attention.`,
        accent: stepAccents[1],
      },
      {
        id: "privacy",
        kicker: t`Privacy choice`,
        title: t`Help improve reliability`,
        body: t`You can opt in to anonymized crash and error reports. This is off by default, and the app works the same either way.`,
        accent: stepAccents[2],
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
  const slideDistance = width + PANEL_GAP;
  const panelWidthStyle = useMemo(() => ({ width }), [width]);
  const progressTrackStyle = useMemo(
    () => ({ backgroundColor: borderColor }),
    [borderColor],
  );
  const trackWidthStyle = useMemo(
    () => ({
      columnGap: PANEL_GAP,
      width: width * STEP_COUNT + PANEL_GAP * (STEP_COUNT - 1),
    }),
    [width],
  );

  const goToStep = useCallback(
    (nextStepIndex: number, easing: EasingFunction = BUTTON_SLIDE_EASING) => {
      const boundedStepIndex = Math.max(
        0,
        Math.min(nextStepIndex, STEP_COUNT - 1),
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
            stepIndex < STEP_COUNT - 1 && gestureState.dx < 0;

          return isHorizontalSwipe && (canSwipeBack || canSwipeForward);
        },
        onPanResponderMove: (_, gestureState) => {
          const dragProgress = stepIndex - gestureState.dx / slideDistance;
          const maxProgress = shouldBlockNotificationAdvance
            ? stepIndex + 0.08
            : STEP_COUNT - 1;
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
    configurePulsar();
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

  const finishOnboarding = useCallback(
    (enableCrashReports: boolean) => {
      playHaptic((presets) => presets.System.notificationSuccess());
      setCrashReportsEnabled(enableCrashReports);
      completeOnboarding();
    },
    [completeOnboarding, setCrashReportsEnabled],
  );

  const handleOptInCrashReports = useCallback(() => {
    playHaptic((presets) => presets.System.notificationSuccess());
    setLocalCrashReportsEnabled(true);
    finishOnboarding(true);
  }, [finishOnboarding]);

  const handleDeclineCrashReports = useCallback(() => {
    playHaptic((presets) => presets.System.impactLight());
    setLocalCrashReportsEnabled(false);
    finishOnboarding(false);
  }, [finishOnboarding]);

  const handleEnableNotifications = useCallback(async () => {
    setIsRequestingPermission(true);
    playHaptic((presets) => presets.System.impactHeavy());

    const result = await requestNotificationPermission();
    await getFcmToken();

    if (isNotificationPermissionEnabled(result)) {
      playHaptic((presets) => presets.System.notificationSuccess());
      setIsRequestingPermission(false);
    } else {
      playHaptic((presets) => presets.System.notificationError());
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

  const renderStepActions = useCallback(
    (contentStepIndex: number) => {
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
            borderColor={borderColor}
            cardColor={cardColor}
            crashReportsEnabled={crashReportsEnabled}
            onDecline={handleDeclineCrashReports}
            onOptIn={handleOptInCrashReports}
            textColor={textColor}
          />
        );
      }

      return (
        <View style={styles.buttonStack}>
          <ActionButton
            accentColor={contentAccentColor}
            icon={{ ios: "arrow.right", android: "arrow_forward" }}
            label={t`Get started`}
            onPress={handleContinue}
          />
        </View>
      );
    },
    [
      borderColor,
      cardColor,
      crashReportsEnabled,
      handleContinue,
      handleDeclineCrashReports,
      handleEnableNotifications,
      handleOpenNotificationSettings,
      handleOptInCrashReports,
      handleSkipNotifications,
      hasNotificationPermission,
      isCheckingPermission,
      isRequestingPermission,
      notificationPermissionStatus,
      stepAccentColors,
      textColor,
      t,
    ],
  );

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
            style={[styles.progressSegment, progressTrackStyle]}
          >
            <ProgressSegmentFill
              index={contentStepIndex}
              inputRange={progressInputRange}
              progress={screenProgress}
              stepAccentColors={stepAccentColors}
            />
          </View>
        ))}
      </View>

      <View style={styles.viewport} {...panResponder.panHandlers}>
        <Animated.View style={[styles.track, trackWidthStyle, trackStyle]}>
          {steps.map((contentStep, contentStepIndex) => {
            const contentAccentColor = stepAccentColors[contentStepIndex];

            return (
              <View
                key={contentStep.id}
                style={[styles.panel, panelWidthStyle]}
              >
                <View style={styles.panelContent}>
                  <View style={styles.panelBody}>
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

type NotificationStepActionsProps = {
  accentColor: string;
  hasNotificationPermission: boolean;
  isCheckingPermission: boolean;
  isRequestingPermission: boolean;
  onContinue: () => void;
  onEnableNotifications: () => void;
  onOpenSettings: () => void;
  onSkip: () => void;
  permissionStatus: Notifications.NotificationPermissionsStatus | null;
  textColor: ColorValue;
};

function NotificationStepActions({
  accentColor,
  hasNotificationPermission: hasNotificationsEnabled,
  isCheckingPermission,
  isRequestingPermission,
  onContinue,
  onEnableNotifications,
  onOpenSettings,
  onSkip,
  permissionStatus,
  textColor,
}: NotificationStepActionsProps) {
  const { t } = useLingui();
  const hasNotificationDecision =
    !isNotificationPermissionPending(permissionStatus);

  if (hasNotificationsEnabled) {
    return (
      <View style={styles.buttonStack}>
        <StatusCard
          description={t`eduMFA can receive push approvals and alert you when a sign-in needs attention.`}
          title={t`Notifications are enabled`}
          variant="success"
        />
        <ActionButton
          accentColor={accentColor}
          icon={{ ios: "arrow.right", android: "arrow_forward" }}
          label={t`Continue`}
          onPress={onContinue}
        />
      </View>
    );
  }

  if (hasNotificationDecision) {
    return (
      <View style={[styles.buttonStack, styles.buttonStackCompact]}>
        <StatusCard
          description={t`eduMFA cannot receive push approvals while notifications are disabled. Enable them in system settings, then return here.`}
          title={t`Notifications are required`}
          variant="error"
        />
        <ActionButton
          accentColor={accentColor}
          icon={{ ios: "gearshape.fill", android: "settings" }}
          label={t`Open notification settings`}
          onPress={onOpenSettings}
        />
        <TextButton color={textColor} label={t`Not now`} onPress={onSkip} />
      </View>
    );
  }

  return (
    <View style={styles.buttonStack}>
      <ActionButton
        accentColor={accentColor}
        icon={{ ios: "bell.fill", android: "notifications" }}
        isLoading={isRequestingPermission || isCheckingPermission}
        label={t`Enable notifications`}
        onPress={onEnableNotifications}
      />
    </View>
  );
}

type CrashReportsStepActionsProps = {
  accentColor: string;
  borderColor: ColorValue;
  cardColor: ColorValue;
  crashReportsEnabled: boolean;
  onDecline: () => void;
  onOptIn: () => void;
  textColor: ColorValue;
};

function CrashReportsStepActions({
  accentColor,
  borderColor,
  cardColor,
  crashReportsEnabled,
  onDecline,
  onOptIn,
  textColor,
}: CrashReportsStepActionsProps) {
  const { t } = useLingui();

  return (
    <View style={styles.buttonStack}>
      <View
        style={[
          styles.choiceCard,
          {
            backgroundColor: cardColor,
            borderColor,
          },
        ]}
      >
        <View style={styles.choiceText}>
          <ThemedText fontSize={Typography.fontSize16} fontWeight="semiBold">
            {t`Anonymous reports`}
          </ThemedText>
          <ThemedText
            themeColor="textSecondary"
            fontSize={Typography.fontSize14}
            style={styles.choiceDescription}
          >
            {t`Share anonymized crash and error reports to help improve reliability. No token secrets, passwords, or institution names.`}
          </ThemedText>
        </View>
        <View
          style={[
            styles.choiceIndicator,
            crashReportsEnabled && { backgroundColor: accentColor },
          ]}
        >
          <SymbolView
            name={{ ios: "hand.raised.fill", android: "privacy_tip" }}
            size={20}
            tintColor={
              crashReportsEnabled ? StaticColors.white : StaticColors.grey
            }
          />
        </View>
      </View>
      <ActionButton
        accentColor={accentColor}
        icon={{ ios: "checkmark.shield.fill", android: "verified_user" }}
        label={t`Share anonymous reports`}
        onPress={onOptIn}
      />
      <TextButton
        color={textColor}
        label={t`Finish without reports`}
        onPress={onDecline}
      />
    </View>
  );
}

type ProgressSegmentFillProps = {
  index: number;
  inputRange: number[];
  progress: SharedValue<number>;
  stepAccentColors: string[];
};

function ProgressSegmentFill({
  index,
  inputRange,
  progress,
  stepAccentColors,
}: ProgressSegmentFillProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const fillProgress = interpolate(
      progress.value,
      [index - 1, index],
      [0, 1],
      Extrapolation.CLAMP,
    );

    return {
      backgroundColor: interpolateColor(
        progress.value,
        inputRange,
        stepAccentColors,
      ),
      width: `${fillProgress * 100}%`,
    };
  });

  return <Animated.View style={[styles.progressFill, animatedStyle]} />;
}

type VisualCardContentProps = {
  accentColor: string;
  index: number;
};

type WelcomeVisualContentProps = {
  logoColor: string;
};

function WelcomeVisualContent({ logoColor }: WelcomeVisualContentProps) {
  return (
    <View style={styles.welcomeVisual}>
      <Image
        contentFit="contain"
        source={logoSource}
        style={styles.logo}
        tintColor={logoColor}
      />
    </View>
  );
}

function VisualCardContent({ accentColor, index }: VisualCardContentProps) {
  const accentStyle = useMemo(
    () => ({ backgroundColor: accentColor }),
    [accentColor],
  );
  const borderStyle = useMemo(
    () => ({ borderColor: accentColor }),
    [accentColor],
  );

  if (index === 1) {
    return (
      <View style={styles.notificationVisual}>
        <View style={[styles.notificationPhone, borderStyle]}>
          <View style={styles.notificationPhoneTop} />
          <View style={[styles.notificationBanner, borderStyle]}>
            <View style={[styles.notificationIconPlate, accentStyle]}>
              <SymbolView
                name={{ ios: "bell.fill", android: "notifications" }}
                size={22}
                tintColor={StaticColors.white}
              />
            </View>
            <View style={styles.notificationCopy}>
              <View style={[styles.notificationLineStrong, accentStyle]} />
              <View style={styles.notificationLine} />
            </View>
          </View>
          <View style={styles.notificationActions}>
            <View style={[styles.notificationAction, accentStyle]} />
            <View style={styles.notificationActionMuted} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.privacyVisual}>
      <View style={[styles.privacySheet, borderStyle]}>
        <View style={styles.privacyHeader}>
          <View style={[styles.privacyIconPlate, accentStyle]}>
            <SymbolView
              name={{ ios: "lock.shield.fill", android: "privacy_tip" }}
              size={24}
              tintColor={StaticColors.white}
            />
          </View>
          <View style={styles.privacyCopy}>
            <View style={[styles.privacyLineStrong, accentStyle]} />
            <View style={styles.privacyLine} />
          </View>
        </View>
        <View style={styles.privacyRows}>
          <View style={styles.privacyRow}>
            <View style={styles.privacyDotMuted} />
            <View style={styles.privacyLine} />
          </View>
          <View style={styles.privacyRow}>
            <View style={[styles.privacyDot, accentStyle]} />
            <View style={styles.privacyLineShort} />
          </View>
        </View>
      </View>
    </View>
  );
}

type ActionButtonProps = {
  accentColor?: string;
  borderColor?: ColorValue;
  color?: ColorValue;
  icon: IconName;
  isLoading?: boolean;
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
};

function ActionButton({
  accentColor,
  borderColor,
  color,
  icon,
  isLoading = false,
  label,
  onPress,
  variant = "primary",
}: ActionButtonProps) {
  const theme = useTheme();
  const isPrimary = variant === "primary";
  const foregroundColor = isPrimary
    ? StaticColors.white
    : (color ?? theme.text);
  const transparentColor = theme.transparent;
  const pressScale = useSharedValue(1);
  const primaryButtonStyle = useMemo(
    () => ({ backgroundColor: accentColor, borderColor: accentColor }),
    [accentColor],
  );
  const secondaryButtonStyle = useMemo(
    () => ({ backgroundColor: transparentColor, borderColor }),
    [borderColor, transparentColor],
  );
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));
  const handlePressIn = () => {
    pressScale.set(withTiming(0.98, { duration: 90 }));
  };
  const handlePressOut = () => {
    pressScale.set(withTiming(1, { duration: 120 }));
  };

  return (
    <AnimatedPressable
      disabled={isLoading}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.actionButton,
        isPrimary ? primaryButtonStyle : secondaryButtonStyle,
        isLoading && styles.actionButtonLoading,
        animatedStyle,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator color={foregroundColor} />
      ) : (
        <SymbolView name={icon} size={18} tintColor={foregroundColor} />
      )}
      <ThemedText
        fontSize={Typography.fontSize16}
        fontWeight="semiBold"
        style={[styles.actionLabel, { color: foregroundColor }]}
      >
        {label}
      </ThemedText>
    </AnimatedPressable>
  );
}

type TextButtonProps = {
  color: ColorValue;
  label: string;
  onPress: () => void;
};

function TextButton({ color, label, onPress }: TextButtonProps) {
  return (
    <Pressable onPress={onPress} style={styles.textButton}>
      <ThemedText
        fontSize={Typography.fontSize14}
        fontWeight="semiBold"
        style={[styles.textButtonLabel, { color }]}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: "center",
    borderCurve: "continuous",
    borderRadius: Radii.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: Spacing.sm,
    justifyContent: "center",
    minHeight: 56,
    paddingHorizontal: Spacing.lg,
  },
  actionButtonLoading: {
    opacity: 0.72,
  },
  actionLabel: {
    lineHeight: Typography.fontSize16 * 1.25,
    textAlign: "center",
  },
  body: {
    lineHeight: Typography.fontSize16 * 1.45,
    textAlign: "center",
  },
  buttonStack: {
    gap: Spacing.md,
    width: "100%",
  },
  buttonStackCompact: {
    gap: Spacing.sm,
  },
  choiceCard: {
    alignItems: "center",
    borderCurve: "continuous",
    borderRadius: Radii.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: Spacing.lg,
    justifyContent: "space-between",
    padding: Spacing.lg,
  },
  choiceDescription: {
    lineHeight: Typography.fontSize14 * 1.4,
  },
  choiceIndicator: {
    alignItems: "center",
    borderColor: StaticColors.grey,
    borderCurve: "continuous",
    borderRadius: Radii.xl,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  choiceText: {
    flex: 1,
    gap: Spacing.xs,
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
  logo: {
    height: 128,
    width: 128,
  },
  notificationAction: {
    borderRadius: Radii.xs,
    flex: 1,
    height: 18,
  },
  notificationActionMuted: {
    backgroundColor: StaticColors.grey,
    borderRadius: Radii.xs,
    flex: 1,
    height: 18,
    opacity: 0.24,
  },
  notificationActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    width: "100%",
  },
  notificationBanner: {
    alignItems: "center",
    borderCurve: "continuous",
    borderRadius: Radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: Spacing.md,
    padding: Spacing.md,
    width: "100%",
  },
  notificationCopy: {
    flex: 1,
    gap: Spacing.sm,
  },
  notificationIconPlate: {
    alignItems: "center",
    borderCurve: "continuous",
    borderRadius: Radii.lg,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  notificationLine: {
    backgroundColor: StaticColors.grey,
    borderRadius: Radii.sm,
    height: 7,
    opacity: 0.28,
    width: "68%",
  },
  notificationLineStrong: {
    borderRadius: Radii.sm,
    height: 8,
    width: "86%",
  },
  notificationPhone: {
    borderCurve: "continuous",
    borderRadius: Radii.xl,
    borderWidth: 1,
    gap: Spacing.md,
    padding: Spacing.lg,
    width: 220,
  },
  notificationPhoneTop: {
    alignSelf: "center",
    backgroundColor: StaticColors.grey,
    borderRadius: Radii.sm,
    height: 5,
    opacity: 0.28,
    width: 48,
  },
  notificationVisual: {
    alignItems: "center",
    justifyContent: "center",
  },
  panel: {
    alignItems: "center",
    justifyContent: "center",
  },
  panelBody: {
    alignItems: "center",
    flex: 1,
    gap: Spacing.xl,
    justifyContent: "center",
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
  privacyCopy: {
    flex: 1,
    gap: Spacing.sm,
  },
  privacyDot: {
    borderRadius: Radii.xl,
    height: 10,
    width: 10,
  },
  privacyDotMuted: {
    backgroundColor: StaticColors.grey,
    borderRadius: Radii.xl,
    height: 10,
    opacity: 0.32,
    width: 10,
  },
  privacyHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.md,
  },
  privacyIconPlate: {
    alignItems: "center",
    borderCurve: "continuous",
    borderRadius: Radii.lg,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  privacyLine: {
    backgroundColor: StaticColors.grey,
    borderRadius: Radii.sm,
    flex: 1,
    height: 7,
    opacity: 0.28,
  },
  privacyLineShort: {
    backgroundColor: StaticColors.grey,
    borderRadius: Radii.sm,
    flex: 0.68,
    height: 7,
    opacity: 0.22,
  },
  privacyLineStrong: {
    borderRadius: Radii.sm,
    height: 8,
    width: "86%",
  },
  privacyRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.sm,
  },
  privacyRows: {
    gap: Spacing.md,
  },
  privacySheet: {
    borderCurve: "continuous",
    borderRadius: Radii.xl,
    borderWidth: 1,
    gap: Spacing.lg,
    padding: Spacing.lg,
    width: 220,
  },
  privacyVisual: {
    alignItems: "center",
    justifyContent: "center",
  },
  progressFill: {
    borderRadius: Radii.sm,
    height: 4,
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
  textButton: {
    alignSelf: "center",
    minHeight: 28,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  textButtonLabel: {
    lineHeight: Typography.fontSize14 * 1.25,
    textAlign: "center",
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
  welcomeVisual: {
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeVisualCard: {
    borderWidth: 0,
    paddingVertical: Spacing.sm,
  },
});
