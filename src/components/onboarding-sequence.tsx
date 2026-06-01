import { ThemedText, useThemeColor } from "@/components/Themed";
import { useNotificationStore } from "@/store/notificationStore";
import { useSettingsStore } from "@/store/settingsStore";
import { theme } from "@/theme";
import { AuthorizationStatus } from "@react-native-firebase/messaging";
import { SymbolView } from "expo-symbols";
import type { ComponentProps } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
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
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type IconName = ComponentProps<typeof SymbolView>["name"];

type OnboardingStep = {
  accent: { light: string; dark: string };
  body: string;
  icon: IconName;
  kicker: string;
  title: string;
};

const steps: OnboardingStep[] = [
  {
    kicker: "Welcome",
    title: "Welcome to eduMFA",
    body: "Keep your sign-ins close at hand with push approvals and tokens that feel simple to manage.",
    icon: { ios: "shield.lefthalf.filled", android: "verified_user" },
    accent: { light: "#0066FF", dark: "#58A6FF" },
  },
  {
    kicker: "Notifications",
    title: "Approve sign-ins the moment they arrive",
    body: "Notifications are important for eduMFA. They let the app receive sign-in approvals and tell you when a push request needs your attention.",
    icon: { ios: "bell.badge.fill", android: "notifications" },
    accent: { light: "#0F9F6E", dark: "#47D7A0" },
  },
  {
    kicker: "Privacy choice",
    title: "Help improve reliability",
    body: "You can opt in to anonymized crash and error reports. This is off by default, and the app works the same either way.",
    icon: { ios: "heart.text.square.fill", android: "privacy_tip" },
    accent: { light: "#8A5CF6", dark: "#B49AFF" },
  },
];

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

export function OnboardingSequence() {
  const [stepIndex, setStepIndex] = useState(0);
  const [crashReportsEnabled, setLocalCrashReportsEnabled] = useState(false);
  const [wasNotificationDeclined, setWasNotificationDeclined] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const requestNotificationPermission = useNotificationStore(
    (state) => state.requestPermission,
  );
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
  const { height } = useWindowDimensions();
  const colorScheme = (useColorScheme() ?? "light") as "light" | "dark";
  const step = steps[stepIndex];
  const accentColor = useThemeColor(step.accent);
  const progress = useSharedValue(0);
  const isLastStep = stepIndex === steps.length - 1;

  const goToStep = useCallback((nextStepIndex: number) => {
    setWasNotificationDeclined(false);
    setStepIndex(nextStepIndex);
  }, []);

  useEffect(() => {
    configurePulsar();
  }, []);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, {
        duration: 2200,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true,
    );
  }, [progress]);

  useEffect(() => {
    if (!wasNotificationDeclined || stepIndex !== 1) {
      return;
    }

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState !== "active") {
        return;
      }

      requestNotificationPermission().then((result) => {
        if (
          result.status === AuthorizationStatus.AUTHORIZED ||
          result.status === AuthorizationStatus.PROVISIONAL
        ) {
          playHaptic((presets) => presets.System.notificationSuccess());
          goToStep(2);
        }
      });
    });

    return () => {
      subscription.remove();
    };
  }, [
    goToStep,
    requestNotificationPermission,
    stepIndex,
    wasNotificationDeclined,
  ]);

  const heroStyle = useAnimatedStyle(() => {
    const scale = interpolate(progress.value, [0, 1], [0.96, 1.04]);
    const rotate = interpolate(progress.value, [0, 1], [-2, 2]);

    return {
      transform: [{ scale }, { rotate: `${rotate}deg` }],
    };
  });

  const haloStyle = useAnimatedStyle(() => {
    const scale = interpolate(progress.value, [0, 1], [0.9, 1.18]);
    const opacity = interpolate(progress.value, [0, 1], [0.22, 0.08]);

    return {
      opacity,
      transform: [{ scale }],
    };
  });

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
      result.status === AuthorizationStatus.PROVISIONAL
    ) {
      playHaptic((presets) => presets.System.notificationSuccess());
      setIsRequestingPermission(false);
      goToStep(2);
    } else {
      playHaptic((presets) => presets.System.notificationError());
      setWasNotificationDeclined(true);
      setIsRequestingPermission(false);
    }
  }, [goToStep, requestNotificationPermission]);

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

  const actionLabel = isLastStep ? "Finish setup" : "Get started";

  const content = useMemo(() => {
    if (stepIndex === 1) {
      return (
        <View style={styles.buttonStack}>
          {wasNotificationDeclined ? (
            <>
              <View
                style={[
                  styles.permissionNotice,
                  {
                    backgroundColor: cardColor,
                    borderColor,
                  },
                ]}
              >
                <ThemedText fontSize={theme.fontSize16} fontWeight="semiBold">
                  Notifications are off
                </ThemedText>
                <ThemedText
                  color={theme.color.textSecondary}
                  fontSize={theme.fontSize14}
                  style={styles.permissionNoticeText}
                >
                  You can enable them in system settings. Without notifications,
                  push approvals may not arrive reliably.
                </ThemedText>
              </View>
              <ActionButton
                accentColor={accentColor}
                icon={{ ios: "gearshape.fill", android: "settings" }}
                label="Open Settings"
                onPress={handleOpenNotificationSettings}
              />
              <ActionButton
                borderColor={borderColor}
                color={textColor}
                icon={{ ios: "arrow.right", android: "arrow_forward" }}
                label="Not now"
                onPress={handleSkipNotifications}
                variant="secondary"
              />
            </>
          ) : (
            <ActionButton
              accentColor={accentColor}
              icon={{ ios: "bell.fill", android: "notifications" }}
              isLoading={isRequestingPermission}
              label="Enable notifications"
              onPress={handleEnableNotifications}
            />
          )}
        </View>
      );
    }

    if (stepIndex === 2) {
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
                No token secrets, passwords, or institution names. This choice
                is yours.
              </ThemedText>
            </View>
            <Switch
              ios_backgroundColor={
                colorScheme === "dark" ? "#3A3A3C" : "#D1D1D6"
              }
              onValueChange={handleCrashReportsChange}
              thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
              trackColor={{
                false: colorScheme === "dark" ? "#3A3A3C" : "#D1D1D6",
                true: accentColor,
              }}
              value={crashReportsEnabled}
            />
          </View>
          <ActionButton
            accentColor={accentColor}
            icon={{ ios: "checkmark", android: "check" }}
            label={actionLabel}
            onPress={handleContinue}
          />
        </View>
      );
    }

    return (
      <View style={styles.buttonStack}>
        <ActionButton
          accentColor={accentColor}
          icon={{ ios: "arrow.right", android: "arrow_forward" }}
          label={actionLabel}
          onPress={handleContinue}
        />
      </View>
    );
  }, [
    accentColor,
    actionLabel,
    borderColor,
    cardColor,
    colorScheme,
    crashReportsEnabled,
    handleContinue,
    handleCrashReportsChange,
    handleEnableNotifications,
    handleOpenNotificationSettings,
    handleSkipNotifications,
    isRequestingPermission,
    stepIndex,
    textColor,
    wasNotificationDeclined,
  ]);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor,
          height,
          paddingBottom: bottom + theme.space24,
          paddingTop: top + theme.space24,
        },
      ]}
    >
      <ProgressIndicator
        activeColor={accentColor}
        currentStep={stepIndex}
        inactiveColor={borderColor}
        stepCount={steps.length}
      />

      <Animated.View
        key={stepIndex}
        entering={FadeIn.duration(220).easing(Easing.out(Easing.cubic))}
        exiting={FadeOut.duration(120).easing(Easing.in(Easing.cubic))}
        style={styles.content}
      >
        <View style={styles.heroWrap}>
          <Animated.View
            style={[
              styles.heroHalo,
              {
                backgroundColor: accentColor,
              },
              haloStyle,
            ]}
          />
          <Animated.View
            style={[
              styles.heroBadge,
              {
                backgroundColor: cardColor,
                borderColor,
              },
              heroStyle,
            ]}
          >
            <SymbolView name={step.icon} size={54} tintColor={accentColor} />
          </Animated.View>
        </View>

        <View style={styles.copy}>
          <ThemedText
            color={step.accent}
            fontSize={theme.fontSize14}
            fontWeight="semiBold"
            style={styles.kicker}
          >
            {step.kicker}
          </ThemedText>
          <ThemedText
            fontSize={theme.fontSize34}
            fontWeight="bold"
            style={styles.title}
          >
            {step.title}
          </ThemedText>
          <ThemedText
            color={theme.color.textSecondary}
            fontSize={theme.fontSize16}
            style={styles.body}
          >
            {step.body}
          </ThemedText>
        </View>

        {content}
      </Animated.View>
    </View>
  );
}

type ProgressIndicatorProps = {
  activeColor: string;
  currentStep: number;
  inactiveColor: string;
  stepCount: number;
};

function ProgressIndicator({
  activeColor,
  currentStep,
  inactiveColor,
  stepCount,
}: ProgressIndicatorProps) {
  const activeSegmentStyle = useMemo(
    () => ({ backgroundColor: activeColor }),
    [activeColor],
  );
  const inactiveSegmentStyle = useMemo(
    () => ({ backgroundColor: inactiveColor }),
    [inactiveColor],
  );

  return (
    <View style={styles.progressWrap}>
      {Array.from({ length: stepCount }, (_, index) => {
        const isActive = index <= currentStep;

        return (
          <Animated.View
            key={index}
            entering={FadeIn}
            exiting={FadeOut}
            style={styles.progressSegmentFrame}
          >
            <View
              style={[
                styles.progressSegment,
                isActive ? activeSegmentStyle : inactiveSegmentStyle,
                isActive
                  ? styles.progressSegmentActive
                  : styles.progressSegmentInactive,
              ]}
            />
          </Animated.View>
        );
      })}
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
    paddingHorizontal: theme.space24,
  },
  content: {
    alignItems: "center",
    gap: theme.space24,
    maxWidth: 520,
    width: "100%",
  },
  copy: {
    alignItems: "center",
    gap: theme.space12,
  },
  heroBadge: {
    alignItems: "center",
    borderCurve: "continuous",
    borderRadius: theme.borderRadius32,
    borderWidth: 1,
    height: 132,
    justifyContent: "center",
    width: 132,
  },
  heroHalo: {
    borderRadius: theme.borderRadius80,
    height: 172,
    position: "absolute",
    width: 172,
  },
  heroWrap: {
    alignItems: "center",
    height: 188,
    justifyContent: "center",
    width: 188,
  },
  kicker: {
    letterSpacing: 0,
    textAlign: "center",
    textTransform: "uppercase",
  },
  permissionNotice: {
    borderCurve: "continuous",
    borderRadius: theme.borderRadius20,
    borderWidth: 1,
    gap: theme.space8,
    padding: theme.space16,
  },
  permissionNoticeText: {
    lineHeight: theme.fontSize14 * 1.4,
  },
  progressSegment: {
    borderRadius: theme.borderRadius4,
    flex: 1,
    height: 4,
  },
  progressSegmentActive: {
    opacity: 1,
  },
  progressSegmentFrame: {
    flex: 1,
    height: 4,
  },
  progressSegmentInactive: {
    opacity: 0.45,
  },
  progressWrap: {
    flexDirection: "row",
    gap: theme.space8,
    maxWidth: 520,
    paddingBottom: theme.space24,
    width: "100%",
  },
  title: {
    lineHeight: theme.fontSize34 * 1.1,
    textAlign: "center",
  },
});
