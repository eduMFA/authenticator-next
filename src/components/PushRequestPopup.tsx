import { usePushRequestStore } from "@/store/pushRequestStore";
import { theme } from "@/theme";
import { PushRequest, PushRequestStatus } from "@/types";
import { useLingui } from "@lingui/react/macro";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useColorScheme,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { ThemedText, useThemeColor } from "./Themed";

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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const colorScheme = useColorScheme();
  const { updatePushRequestStatus } = usePushRequestStore();

  // Filter to only pending requests
  const pendingRequests = requests.filter(
    (r) => r.status === PushRequestStatus.Pending,
  );

  const currentRequest = pendingRequests[currentIndex];
  const hasRequests = pendingRequests.length > 0;
  const totalPending = pendingRequests.length;

  // Reset index if it's out of bounds
  useEffect(() => {
    if (currentIndex >= pendingRequests.length && pendingRequests.length > 0) {
      setCurrentIndex(pendingRequests.length - 1);
    } else if (pendingRequests.length === 0) {
      setCurrentIndex(0);
    }
  }, [pendingRequests.length, currentIndex]);

  const handleAction = useCallback(
    (action: "accept" | "decline") => {
      if (!currentRequest || isAnimatingOut) return;

      Haptics.impactAsync(
        action === "accept"
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light,
      );

      setIsAnimatingOut(true);

      // Delay the action to allow exit animation
      setTimeout(() => {
        updatePushRequestStatus(
          currentRequest.id,
          action === "accept"
            ? PushRequestStatus.Accepted
            : PushRequestStatus.Declined,
        );
        onAction(currentRequest);
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
  const backgroundColor = useThemeColor(theme.color.background);
  const borderColor = useThemeColor(theme.color.border);
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
              fontSize={theme.fontSize12}
              color={theme.color.textSecondary}
            >
              {currentIndex + 1} of {totalPending}
            </ThemedText>
          </Animated.View>
        )}

        {/* Header */}
        <View style={styles.header}>
          <ThemedText
            fontSize={theme.fontSize20}
            fontWeight="semiBold"
            style={styles.title}
          >
            {request.title || "Authentication Request"}
          </ThemedText>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <ThemedText
            fontSize={theme.fontSize16}
            color={theme.color.textSecondary}
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
        fontSize={theme.fontSize14}
        color={theme.color.textSecondary}
        style={styles.detailLabel}
      >
        {label}
      </ThemedText>
      <ThemedText
        fontSize={theme.fontSize14}
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
  const brandingColor = useThemeColor(theme.color.branding);
  const backgroundColor = useThemeColor(theme.color.backgroundSecondary);
  const pressScale = useSharedValue(1);
  const primaryButtonStyle = useMemo(
    () => ({ backgroundColor: brandingColor }),
    [brandingColor],
  );
  const secondaryButtonStyle = useMemo(
    () => ({ backgroundColor, borderColor: brandingColor }),
    [backgroundColor, brandingColor],
  );
  const secondaryButtonTextStyle = useMemo(
    () => ({ color: brandingColor }),
    [brandingColor],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const handlePressIn = () => {
    pressScale.value = withTiming(0.95, { duration: 100 });
  };

  const handlePressOut = () => {
    pressScale.value = withTiming(1, { duration: 100 });
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
        fontSize={theme.fontSize16}
        fontWeight="semiBold"
        style={[
          styles.buttonText,
          isPrimary ? styles.buttonPrimaryText : secondaryButtonTextStyle,
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
    borderRadius: theme.borderRadius12,
    flex: 1,
    justifyContent: "center",
    paddingVertical: theme.space12,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: theme.space12,
    padding: theme.space16,
    paddingTop: theme.space8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonPrimaryText: {
    color: theme.colorWhite,
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
    paddingHorizontal: theme.space24,
    paddingVertical: theme.space16,
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
    borderRadius: theme.borderRadius12,
    borderWidth: 1,
    padding: theme.space12,
  },
  header: {
    alignItems: "center",
    paddingHorizontal: theme.space24,
    paddingTop: theme.space16,
  },
  popup: {
    borderRadius: theme.borderRadius20,
    borderWidth: 1,
    elevation: 12,
    overflow: "hidden",
    shadowColor: theme.colorBlack,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
  },
  question: {
    marginBottom: theme.space16,
    textAlign: "center",
  },
  queueIndicator: {
    alignItems: "center",
    paddingTop: theme.space12,
  },
  title: {
    textAlign: "center",
  },
});
