import { ThemedText, useThemeColor } from "@/components/Themed";
import { useNotificationStore } from "@/store/notificationStore";
import { useSettingsStore } from "@/store/settingsStore";
import { theme } from "@/theme";
import { AuthorizationStatus } from "@react-native-firebase/messaging";
import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import type { ComponentProps, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  View,
  useColorScheme,
  useWindowDimensions,
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
const PANEL_GAP = theme.space24 * 3;
const logoSource = require("../../assets/app-icons/edumfa.icon/Assets/logo.svg");

type IconName = ComponentProps<typeof SymbolView>["name"];
type FirebaseAuthorizationStatus =
  (typeof AuthorizationStatus)[keyof typeof AuthorizationStatus];

type OnboardingStep = {
  accent: { light: string; dark: string };
  body: string;
  kicker: string;
  title: string;
};

const steps: OnboardingStep[] = [
  {
    kicker: "Welcome",
    title: "Welcome to eduMFA",
    body: "Keep your sign-ins close at hand with push approvals and tokens that feel simple to manage.",
    accent: { light: "#0066FF", dark: "#58A6FF" },
  },
  {
    kicker: "Notifications",
    title: "Approve sign-ins the moment they arrive",
    body: "Notifications are important for eduMFA. They let the app receive sign-in approvals and tell you when a push request needs your attention.",
    accent: { light: "#0F9F6E", dark: "#47D7A0" },
  },
  {
    kicker: "Privacy choice",
    title: "Help improve reliability",
    body: "You can opt in to anonymized crash and error reports. This is off by default, and the app works the same either way.",
    accent: { light: "#8A5CF6", dark: "#B49AFF" },
  },
];

const progressInputRange = steps.map((_, index) => index);

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

function hasNotificationPermission(status: FirebaseAuthorizationStatus | null) {
  return (
    status === AuthorizationStatus.AUTHORIZED ||
    status === AuthorizationStatus.PROVISIONAL ||
    status === AuthorizationStatus.EPHEMERAL
  );
}

function isNotificationPermissionPending(
  status: FirebaseAuthorizationStatus | null,
) {
  return status === null || status === AuthorizationStatus.NOT_DETERMINED;
}

export function OnboardingSequence() {
  const [stepIndex, setStepIndex] = useState(0);
  const [crashReportsEnabled, setLocalCrashReportsEnabled] = useState(false);
  const [isCheckingPermission, setIsCheckingPermission] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const notificationPermissionStatus = useNotificationStore(
    (state) => state.permissionStatus,
  );
  const checkNotificationPermission = useNotificationStore(
    (state) => state.checkPermission,
  );
  const requestNotificationPermission = useNotificationStore(
    (state) => state.requestPermission,
  );
  const getFcmToken = useNotificationStore((state) => state.getFcmToken);
  const completeOnboarding = useSettingsStore(
    (state) => state.completeOnboarding,
  );
  const setCrashReportsEnabled = useSettingsStore(
    (state) => state.setCrashReportsEnabled,
  );
  const backgroundColor = useThemeColor(theme.color.background);
  const cardColor = useThemeColor(theme.color.backgroundSecondary);
  const textColor = useThemeColor(theme.color.text);
  const borderColor = useThemeColor(theme.color.border);
  const { bottom, top } = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const colorScheme = (useColorScheme() ?? "light") as "light" | "dark";
  const stepAccentColors = useMemo(
    () => steps.map((item) => item.accent[colorScheme]),
    [colorScheme],
  );
  const screenProgress = useSharedValue(0);
  const isLastStep = stepIndex === steps.length - 1;
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
      width: width * steps.length + PANEL_GAP * (steps.length - 1),
    }),
    [width],
  );

  const goToStep = useCallback(
    (nextStepIndex: number) => {
      const boundedStepIndex = Math.max(
        0,
        Math.min(nextStepIndex, steps.length - 1),
      );

      setStepIndex(boundedStepIndex);
      screenProgress.set(
        withTiming(boundedStepIndex, {
          duration: 360,
          easing: Easing.out(Easing.cubic),
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
      const status = await checkNotificationPermission();

      if (hasNotificationPermission(status)) {
        await getFcmToken();
      }
    } finally {
      setIsCheckingPermission(false);
    }
  }, [checkNotificationPermission, getFcmToken, stepIndex]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          const isHorizontalSwipe =
            Math.abs(gestureState.dx) > theme.space8 &&
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
          const canSwipeBack = stepIndex > 0 && gestureState.dx > 0;
          const canSwipeForward =
            stepIndex < steps.length - 1 && gestureState.dx < 0;

          return isHorizontalSwipe && (canSwipeBack || canSwipeForward);
        },
        onPanResponderMove: (_, gestureState) => {
          const dragProgress = stepIndex - gestureState.dx / slideDistance;
          const maxProgress = shouldBlockNotificationAdvance
            ? stepIndex + 0.08
            : steps.length - 1;
          const boundedDragProgress = Math.min(
            maxProgress,
            Math.max(0, dragProgress),
          );

          screenProgress.set(boundedDragProgress);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx > slideDistance * 0.25) {
            playHaptic((presets) => presets.System.impactLight());
            goToStep(stepIndex - 1);
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
            goToStep(stepIndex + 1);
            return;
          }

          screenProgress.set(
            withTiming(stepIndex, {
              duration: 220,
              easing: Easing.out(Easing.cubic),
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
    if (!isLastStep) {
      playHaptic((presets) => presets.System.impactMedium());
      goToStep(stepIndex + 1);
      return;
    }

    playHaptic((presets) => presets.System.notificationSuccess());
    setCrashReportsEnabled(crashReportsEnabled);
    completeOnboarding();
  }, [
    completeOnboarding,
    crashReportsEnabled,
    goToStep,
    isLastStep,
    setCrashReportsEnabled,
    stepIndex,
  ]);

  const handleEnableNotifications = useCallback(async () => {
    setIsRequestingPermission(true);
    playHaptic((presets) => presets.System.impactHeavy());

    const result = await requestNotificationPermission();

    if (
      result.status === AuthorizationStatus.AUTHORIZED ||
      result.status === AuthorizationStatus.PROVISIONAL ||
      result.status === AuthorizationStatus.EPHEMERAL
    ) {
      playHaptic((presets) => presets.System.notificationSuccess());
      setIsRequestingPermission(false);
    } else {
      playHaptic((presets) => presets.System.notificationError());
      setIsRequestingPermission(false);
    }
  }, [requestNotificationPermission]);

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

  const handleCrashReportsChange = useCallback((enabled: boolean) => {
    playHaptic((presets) => {
      if (enabled) {
        presets.System.impactMedium();
      } else {
        presets.System.impactLight();
      }
    });
    setLocalCrashReportsEnabled(enabled);
  }, []);

  const renderStepActions = useCallback(
    (contentStepIndex: number) => {
      const contentAccentColor = stepAccentColors[contentStepIndex];

      if (contentStepIndex === 1) {
        return (
          <NotificationStepActions
            accentColor={contentAccentColor}
            cardColor={cardColor}
            colorScheme={colorScheme}
            isCheckingPermission={isCheckingPermission}
            isRequestingPermission={isRequestingPermission}
            onContinue={handleContinue}
            onEnableNotifications={handleEnableNotifications}
            onOpenSettings={handleOpenNotificationSettings}
            onSkip={handleSkipNotifications}
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
            colorScheme={colorScheme}
            crashReportsEnabled={crashReportsEnabled}
            onChange={handleCrashReportsChange}
            onContinue={handleContinue}
          />
        );
      }

      return (
        <View style={styles.buttonStack}>
          <ActionButton
            accentColor={contentAccentColor}
            icon={{ ios: "arrow.right", android: "arrow_forward" }}
            label="Get started"
            onPress={handleContinue}
          />
        </View>
      );
    },
    [
      borderColor,
      cardColor,
      colorScheme,
      crashReportsEnabled,
      handleContinue,
      handleCrashReportsChange,
      handleEnableNotifications,
      handleOpenNotificationSettings,
      handleSkipNotifications,
      isCheckingPermission,
      isRequestingPermission,
      notificationPermissionStatus,
      stepAccentColors,
      textColor,
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
          paddingTop: top + theme.space24,
        },
      ]}
    >
      <View style={styles.progressWrap}>
        {steps.map((contentStep, contentStepIndex) => (
          <View
            key={contentStep.title}
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
                key={contentStep.title}
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
                          <WelcomeVisualContent logoColor={textColor} />
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
                        color={contentStep.accent}
                        fontSize={theme.fontSize14}
                        fontWeight="semiBold"
                        style={styles.kicker}
                      >
                        {contentStep.kicker}
                      </ThemedText>
                      <ThemedText
                        fontSize={theme.fontSize34}
                        fontWeight="bold"
                        style={styles.title}
                      >
                        {contentStep.title}
                      </ThemedText>
                      <ThemedText
                        color={theme.color.textSecondary}
                        fontSize={theme.fontSize16}
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
  cardColor: string;
  colorScheme: "light" | "dark";
  isCheckingPermission: boolean;
  isRequestingPermission: boolean;
  onContinue: () => void;
  onEnableNotifications: () => void;
  onOpenSettings: () => void;
  onSkip: () => void;
  permissionStatus: FirebaseAuthorizationStatus | null;
  textColor: string;
};

function NotificationStepActions({
  accentColor,
  cardColor,
  colorScheme,
  isCheckingPermission,
  isRequestingPermission,
  onContinue,
  onEnableNotifications,
  onOpenSettings,
  onSkip,
  permissionStatus,
  textColor,
}: NotificationStepActionsProps) {
  const hasNotificationsEnabled = hasNotificationPermission(permissionStatus);
  const hasNotificationDecision =
    !isNotificationPermissionPending(permissionStatus);
  const notificationSettingsGuidance =
    Platform.OS === "ios"
      ? "Settings -> eduMFA -> Notifications -> Allow Notifications."
      : "Settings -> eduMFA -> Notifications or Permissions -> Allow.";

  if (hasNotificationsEnabled) {
    return (
      <View style={styles.buttonStack}>
        <NotificationStatusNotice
          borderColor={accentColor}
          cardColor={cardColor}
          icon={{ ios: "checkmark.circle.fill", android: "check_circle" }}
          iconColor={accentColor}
          title="Notifications are enabled"
        >
          <ThemedText
            color={theme.color.textSecondary}
            fontSize={theme.fontSize14}
            style={styles.permissionNoticeText}
          >
            eduMFA can receive push approvals and alert you when a sign-in needs
            attention.
          </ThemedText>
        </NotificationStatusNotice>
        <ActionButton
          accentColor={accentColor}
          icon={{ ios: "arrow.right", android: "arrow_forward" }}
          label="Continue"
          onPress={onContinue}
        />
      </View>
    );
  }

  if (hasNotificationDecision) {
    const errorColor = theme.color.errorBar[colorScheme];

    return (
      <View style={[styles.buttonStack, styles.buttonStackCompact]}>
        <NotificationStatusNotice
          borderColor={errorColor}
          cardColor={cardColor}
          icon={{ ios: "exclamationmark.circle.fill", android: "error" }}
          iconColor={errorColor}
          isCritical
          title="Notifications are required"
          titleColor={theme.color.errorBar}
        >
          <ThemedText
            color={theme.color.textSecondary}
            fontSize={theme.fontSize14}
            style={styles.permissionNoticeTextCompact}
          >
            eduMFA cannot receive push approvals while notifications are
            disabled. Enable them in system settings, then return here.
          </ThemedText>
          <ThemedText
            color={theme.color.textSecondary}
            fontSize={theme.fontSize12}
            style={styles.permissionNoticePath}
          >
            {notificationSettingsGuidance}
          </ThemedText>
        </NotificationStatusNotice>
        <ActionButton
          accentColor={accentColor}
          icon={{ ios: "gearshape.fill", android: "settings" }}
          label="Open notification settings"
          onPress={onOpenSettings}
        />
        <TextButton color={textColor} label="Not now" onPress={onSkip} />
      </View>
    );
  }

  return (
    <View style={styles.buttonStack}>
      <ActionButton
        accentColor={accentColor}
        icon={{ ios: "bell.fill", android: "notifications" }}
        isLoading={isRequestingPermission || isCheckingPermission}
        label="Enable notifications"
        onPress={onEnableNotifications}
      />
    </View>
  );
}

type NotificationStatusNoticeProps = {
  borderColor: string;
  cardColor: string;
  children: ReactNode;
  icon: IconName;
  iconColor: string;
  isCritical?: boolean;
  title: string;
  titleColor?: { light: string; dark: string };
};

function NotificationStatusNotice({
  borderColor,
  cardColor,
  children,
  icon,
  iconColor,
  isCritical = false,
  title,
  titleColor,
}: NotificationStatusNoticeProps) {
  return (
    <View
      style={[
        styles.permissionNotice,
        isCritical && styles.permissionNoticeCritical,
        { backgroundColor: cardColor, borderColor },
      ]}
    >
      <View style={styles.permissionNoticeHeader}>
        <SymbolView name={icon} size={20} tintColor={iconColor} />
        <ThemedText
          color={titleColor}
          fontSize={theme.fontSize16}
          fontWeight={isCritical ? "bold" : "semiBold"}
        >
          {title}
        </ThemedText>
      </View>
      {children}
    </View>
  );
}

type CrashReportsStepActionsProps = {
  accentColor: string;
  borderColor: string;
  cardColor: string;
  colorScheme: "light" | "dark";
  crashReportsEnabled: boolean;
  onChange: (enabled: boolean) => void;
  onContinue: () => void;
};

function CrashReportsStepActions({
  accentColor,
  borderColor,
  cardColor,
  colorScheme,
  crashReportsEnabled,
  onChange,
  onContinue,
}: CrashReportsStepActionsProps) {
  const disabledTrackColor = colorScheme === "dark" ? "#3A3A3C" : "#D1D1D6";

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
          <ThemedText fontSize={theme.fontSize16} fontWeight="semiBold">
            Anonymous reports
          </ThemedText>
          <ThemedText
            color={theme.color.textSecondary}
            fontSize={theme.fontSize14}
            style={styles.choiceDescription}
          >
            No token secrets, passwords, or institution names. This choice is
            yours.
          </ThemedText>
        </View>
        <Switch
          ios_backgroundColor={disabledTrackColor}
          onValueChange={onChange}
          thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
          trackColor={{
            false: disabledTrackColor,
            true: accentColor,
          }}
          value={crashReportsEnabled}
        />
      </View>
      <ActionButton
        accentColor={accentColor}
        icon={{ ios: "checkmark", android: "check" }}
        label="Finish setup"
        onPress={onContinue}
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
                tintColor={theme.colorWhite}
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
              tintColor={theme.colorWhite}
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
  borderColor?: string;
  color?: string;
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
  const isPrimary = variant === "primary";
  const foregroundColor = isPrimary ? theme.colorWhite : color;
  const transparentColor = useThemeColor(theme.color.transparent);
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
        color={foregroundColor}
        fontSize={theme.fontSize16}
        fontWeight="semiBold"
        style={styles.actionLabel}
      >
        {label}
      </ThemedText>
    </AnimatedPressable>
  );
}

type TextButtonProps = {
  color: string;
  label: string;
  onPress: () => void;
};

function TextButton({ color, label, onPress }: TextButtonProps) {
  return (
    <Pressable onPress={onPress} style={styles.textButton}>
      <ThemedText
        color={color}
        fontSize={theme.fontSize14}
        fontWeight="semiBold"
        style={styles.textButtonLabel}
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
    borderRadius: theme.borderRadius20,
    borderWidth: 1,
    flexDirection: "row",
    gap: theme.space8,
    justifyContent: "center",
    minHeight: 56,
    paddingHorizontal: theme.space16,
  },
  actionButtonLoading: {
    opacity: 0.72,
  },
  actionLabel: {
    lineHeight: theme.fontSize16 * 1.25,
    textAlign: "center",
  },
  body: {
    lineHeight: theme.fontSize16 * 1.45,
    textAlign: "center",
  },
  buttonStack: {
    gap: theme.space12,
    width: "100%",
  },
  buttonStackCompact: {
    gap: theme.space8,
  },
  choiceCard: {
    alignItems: "center",
    borderCurve: "continuous",
    borderRadius: theme.borderRadius20,
    borderWidth: 1,
    flexDirection: "row",
    gap: theme.space16,
    justifyContent: "space-between",
    padding: theme.space16,
  },
  choiceDescription: {
    lineHeight: theme.fontSize14 * 1.4,
  },
  choiceText: {
    flex: 1,
    gap: theme.space4,
  },
  container: {
    alignItems: "center",
    justifyContent: "space-between",
  },
  copy: {
    alignItems: "center",
    gap: theme.space12,
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
    borderRadius: theme.borderRadius6,
    flex: 1,
    height: 18,
  },
  notificationActionMuted: {
    backgroundColor: theme.colorGrey,
    borderRadius: theme.borderRadius6,
    flex: 1,
    height: 18,
    opacity: 0.24,
  },
  notificationActions: {
    flexDirection: "row",
    gap: theme.space8,
    width: "100%",
  },
  notificationBanner: {
    alignItems: "center",
    borderCurve: "continuous",
    borderRadius: theme.borderRadius12,
    borderWidth: 1,
    flexDirection: "row",
    gap: theme.space12,
    padding: theme.space12,
    width: "100%",
  },
  notificationCopy: {
    flex: 1,
    gap: theme.space8,
  },
  notificationIconPlate: {
    alignItems: "center",
    borderCurve: "continuous",
    borderRadius: theme.borderRadius12,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  notificationLine: {
    backgroundColor: theme.colorGrey,
    borderRadius: theme.borderRadius4,
    height: 7,
    opacity: 0.28,
    width: "68%",
  },
  notificationLineStrong: {
    borderRadius: theme.borderRadius4,
    height: 8,
    width: "86%",
  },
  notificationPhone: {
    borderCurve: "continuous",
    borderRadius: theme.borderRadius20,
    borderWidth: 1,
    gap: theme.space12,
    padding: theme.space16,
    width: 220,
  },
  notificationPhoneTop: {
    alignSelf: "center",
    backgroundColor: theme.colorGrey,
    borderRadius: theme.borderRadius4,
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
    gap: theme.space24,
    justifyContent: "center",
    width: "100%",
  },
  panelContent: {
    alignItems: "center",
    flex: 1,
    gap: theme.space24,
    justifyContent: "space-between",
    maxWidth: 520,
    paddingHorizontal: theme.space24,
    width: "100%",
  },
  permissionNotice: {
    borderCurve: "continuous",
    borderRadius: theme.borderRadius20,
    borderWidth: 1,
    gap: theme.space8,
    padding: theme.space16,
  },
  permissionNoticeCritical: {
    borderWidth: 2,
    gap: theme.space4,
    padding: theme.space12,
  },
  permissionNoticeHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.space8,
  },
  permissionNoticePath: {
    lineHeight: theme.fontSize12 * 1.25,
  },
  permissionNoticeText: {
    lineHeight: theme.fontSize14 * 1.4,
  },
  permissionNoticeTextCompact: {
    lineHeight: theme.fontSize14 * 1.3,
  },
  privacyCopy: {
    flex: 1,
    gap: theme.space8,
  },
  privacyDot: {
    borderRadius: theme.borderRadius20,
    height: 10,
    width: 10,
  },
  privacyDotMuted: {
    backgroundColor: theme.colorGrey,
    borderRadius: theme.borderRadius20,
    height: 10,
    opacity: 0.32,
    width: 10,
  },
  privacyHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.space12,
  },
  privacyIconPlate: {
    alignItems: "center",
    borderCurve: "continuous",
    borderRadius: theme.borderRadius12,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  privacyLine: {
    backgroundColor: theme.colorGrey,
    borderRadius: theme.borderRadius4,
    flex: 1,
    height: 7,
    opacity: 0.28,
  },
  privacyLineShort: {
    backgroundColor: theme.colorGrey,
    borderRadius: theme.borderRadius4,
    flex: 0.68,
    height: 7,
    opacity: 0.22,
  },
  privacyLineStrong: {
    borderRadius: theme.borderRadius4,
    height: 8,
    width: "86%",
  },
  privacyRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.space8,
  },
  privacyRows: {
    gap: theme.space12,
  },
  privacySheet: {
    borderCurve: "continuous",
    borderRadius: theme.borderRadius20,
    borderWidth: 1,
    gap: theme.space16,
    padding: theme.space16,
    width: 220,
  },
  privacyVisual: {
    alignItems: "center",
    justifyContent: "center",
  },
  progressFill: {
    borderRadius: theme.borderRadius4,
    height: 4,
  },
  progressSegment: {
    borderRadius: theme.borderRadius4,
    flex: 1,
    height: 4,
    overflow: "hidden",
  },
  progressWrap: {
    flexDirection: "row",
    gap: theme.space8,
    paddingHorizontal: theme.space24,
    width: "100%",
  },
  textButton: {
    alignSelf: "center",
    minHeight: 28,
    paddingHorizontal: theme.space8,
    paddingVertical: theme.space4,
  },
  textButtonLabel: {
    lineHeight: theme.fontSize14 * 1.25,
    textAlign: "center",
  },
  title: {
    lineHeight: theme.fontSize34 * 1.1,
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
    borderRadius: theme.borderRadius10,
    borderWidth: 1,
    height: 172,
    justifyContent: "center",
    padding: theme.space16,
    width: "100%",
  },
  welcomeVisual: {
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeVisualCard: {
    borderWidth: 0,
    paddingVertical: theme.space8,
  },
});
