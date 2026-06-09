import { usePushRequestStore } from "@/store/push-request-store";
import { Radii, Spacing, StaticColors, Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { PushRequest, PushRequestStatus } from "@/types";
import { useLingui } from "@lingui/react/macro";
import { BlurView } from "expo-blur";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useColorScheme,
} from "react-native";
import { Presets } from "react-native-pulsar";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { ThemedText } from "./themed-text";

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const POPUP_WIDTH = Math.min(Dimensions.get("window").width - 48, 340);

type PushRequestPopupProps = {
  requests: PushRequest[];
  onAction: (request: PushRequest) => void;
};

export function PushRequestPopup({
  requests,
  onAction,
}: PushRequestPopupProps) {
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const colorScheme = useColorScheme();
  const { updatePushRequestStatus } = usePushRequestStore();

  // Filter to only pending requests
  const pendingRequests = requests.filter(
    (r) => r.status === PushRequestStatus.Pending,
  );

  const currentIndex = 0;
  const currentRequest = pendingRequests[currentIndex];
  const hasRequests = pendingRequests.length > 0;
  const totalPending = pendingRequests.length;

  const handleAction = useCallback(
    (action: "accept" | "decline") => {
      if (!currentRequest || isAnimatingOut) return;

      let pushRequestStatus: PushRequestStatus;
      if (action === "accept") {
        Presets.System.impactMedium();
        pushRequestStatus = PushRequestStatus.Accepted;
      } else {
        Presets.System.impactLight();
        pushRequestStatus = PushRequestStatus.Declined;
      }

      setIsAnimatingOut(true);

      // Delay the action to allow exit animation
      setTimeout(() => {
        const updatedRequest = {
          ...currentRequest,
          status: pushRequestStatus,
        };

        updatePushRequestStatus(updatedRequest.id, updatedRequest.status);
        onAction(updatedRequest);
        setIsAnimatingOut(false);
      }, 200);
    },
    [currentRequest, isAnimatingOut, onAction, updatePushRequestStatus],
  );

  if (!hasRequests || !currentRequest) {
    return null;
  }

  return (
    <Modal
      visible={hasRequests}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* Backdrop - blurs entire screen including nav */}
        <AnimatedBlurView
          style={StyleSheet.absoluteFill}
          intensity={50}
          tint={colorScheme === "dark" ? "dark" : "light"}
          entering={FadeIn.duration(250)}
          exiting={FadeOut.duration(200)}
        />

        {/* Popup Card */}
        <PopupCard
          request={currentRequest}
          currentIndex={currentIndex}
          totalPending={totalPending}
          onAction={(action) => handleAction(action)}
          isAnimatingOut={isAnimatingOut}
        />
      </View>
    </Modal>
  );
}

type PopupCardProps = {
  request: PushRequest;
  currentIndex: number;
  totalPending: number;
  onAction: (action: "accept" | "decline") => void;
  isAnimatingOut: boolean;
};

function PopupCard({
  request,
  currentIndex,
  totalPending,
  onAction,
  isAnimatingOut,
}: PopupCardProps) {
  const theme = useTheme();
  const backgroundColor = theme.background;
  const borderColor = theme.border;
  const { t } = useLingui();

  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withTiming(1, {
      duration: 300,
      easing: Easing.out(Easing.quad),
    });
    opacity.value = withTiming(1, {
      duration: 300,
      easing: Easing.out(Easing.quad),
    });
  }, [opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
    >
      <Animated.View
        style={[
          styles.popup,
          {
            backgroundColor,
            borderColor,
            width: POPUP_WIDTH,
          },
          animatedStyle,
        ]}
      >
        {/* Queue indicator */}
        {totalPending > 1 && (
          <Animated.View
            style={styles.queueIndicator}
            entering={FadeIn.delay(200)}
          >
            <ThemedText
              fontSize={Typography.fontSize12}
              themeColor="textSecondary"
            >
              {currentIndex + 1} of {totalPending}
            </ThemedText>
          </Animated.View>
        )}

        {/* Header */}
        <View style={styles.header}>
          <ThemedText
            fontSize={Typography.fontSize20}
            fontWeight="semiBold"
            style={styles.title}
          >
            {request.title || "Authentication Request"}
          </ThemedText>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <ThemedText
            fontSize={Typography.fontSize16}
            themeColor="textSecondary"
            style={styles.question}
          >
            {request.question || "Do you want to confirm this authentication?"}
          </ThemedText>

          {/* Request details */}
          <View style={[styles.detailsContainer, { borderColor }]}>
            <DetailRow label={t`Serial`} value={request.serial} />
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <ActionButton
            label={t`Decline`}
            onPress={() => onAction("decline")}
            variant="secondary"
            disabled={isAnimatingOut}
          />
          <ActionButton
            label={t`Accept`}
            onPress={() => onAction("accept")}
            variant="primary"
            disabled={isAnimatingOut}
          />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <ThemedText
        fontSize={Typography.fontSize14}
        themeColor="textSecondary"
        style={styles.detailLabel}
      >
        {label}
      </ThemedText>
      <ThemedText
        fontSize={Typography.fontSize14}
        fontWeight="medium"
        style={styles.detailValue}
        numberOfLines={1}
      >
        {value}
      </ThemedText>
    </View>
  );
}

type ActionButtonProps = {
  label: string;
  onPress: () => void;
  variant: "primary" | "secondary";
  disabled?: boolean;
};

function ActionButton({
  label,
  onPress,
  variant,
  disabled,
}: ActionButtonProps) {
  const theme = useTheme();
  const brandingColor = theme.branding;
  const backgroundColor = theme.fill;
  const primaryButtonTextColor = theme.textOnBranding;
  const secondaryButtonTextColor = theme.branding;
  const pressScale = useSharedValue(1);
  const primaryButtonStyle = useMemo(
    () => ({ backgroundColor: brandingColor }),
    [brandingColor],
  );
  const secondaryButtonStyle = useMemo(
    () => ({ backgroundColor, borderColor: brandingColor }),
    [backgroundColor, brandingColor],
  );
  const primaryButtonTextStyle = useMemo(
    () => ({ color: primaryButtonTextColor }),
    [primaryButtonTextColor],
  );
  const secondaryButtonTextStyle = useMemo(
    () => ({ color: secondaryButtonTextColor }),
    [secondaryButtonTextColor],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const handlePressIn = () => {
    pressScale.set(withTiming(0.95, { duration: 100 }));
  };

  const handlePressOut = () => {
    pressScale.set(withTiming(1, { duration: 100 }));
  };

  const isPrimary = variant === "primary";

  return (
    <AnimatedPressable
      style={[
        styles.button,
        isPrimary
          ? primaryButtonStyle
          : [styles.buttonSecondary, secondaryButtonStyle],
        animatedStyle,
        disabled && styles.buttonDisabled,
      ]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
    >
      <ThemedText
        fontSize={Typography.fontSize16}
        fontWeight="semiBold"
        style={[
          styles.buttonText,
          isPrimary ? primaryButtonTextStyle : secondaryButtonTextStyle,
        ]}
      >
        {label}
      </ThemedText>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: Radii.lg,
    flex: 1,
    justifyContent: "center",
    paddingVertical: Spacing.md,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: Spacing.md,
    padding: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonSecondary: {
    borderWidth: 1,
  },
  buttonText: {
    textAlign: "center",
  },
  container: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  detailLabel: {
    flex: 1,
  },
  detailRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailValue: {
    flex: 2,
    textAlign: "right",
  },
  detailsContainer: {
    borderRadius: Radii.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  header: {
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  popup: {
    borderRadius: Radii.xl,
    borderWidth: 1,
    elevation: 12,
    overflow: "hidden",
    shadowColor: StaticColors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
  },
  question: {
    marginBottom: Spacing.lg,
    textAlign: "center",
  },
  queueIndicator: {
    alignItems: "center",
    paddingTop: Spacing.md,
  },
  title: {
    textAlign: "center",
  },
});
