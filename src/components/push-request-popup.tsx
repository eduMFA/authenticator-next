import { Radii, Spacing, Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { usePushRequestStore } from "@/stores/push-request";
import { useTokenStore } from "@/stores/token";
import type { PushRequest } from "@/types/push-request";
import { PushRequestStatus } from "@/types/push-request";
import { useLingui } from "@lingui/react/macro";
import { BlurView } from "expo-blur";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useColorScheme,
  useWindowDimensions,
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
import { TokenImage } from "./token-image";

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  const pendingRequests = requests.filter(
    (request) => request.status === PushRequestStatus.Pending,
  );
  const currentRequest = pendingRequests[0];

  const handleAction = useCallback(
    (action: "accept" | "decline") => {
      if (!currentRequest || isAnimatingOut) return;

      const status =
        action === "accept"
          ? PushRequestStatus.Accepted
          : PushRequestStatus.Declined;

      if (action === "accept") {
        Presets.System.impactMedium();
      } else {
        Presets.System.impactLight();
      }

      setIsAnimatingOut(true);
      setTimeout(() => {
        const updatedRequest = { ...currentRequest, status };
        updatePushRequestStatus(updatedRequest.id, status);
        onAction(updatedRequest);
        setIsAnimatingOut(false);
      }, 200);
    },
    [currentRequest, isAnimatingOut, onAction, updatePushRequestStatus],
  );

  if (!currentRequest) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => handleAction("decline")}
    >
      <View style={styles.container}>
        <AnimatedBlurView
          style={StyleSheet.absoluteFill}
          intensity={55}
          tint={colorScheme === "dark" ? "dark" : "light"}
          entering={FadeIn.duration(250)}
          exiting={FadeOut.duration(200)}
        />
        <PopupCard
          request={currentRequest}
          totalPending={pendingRequests.length}
          onAction={handleAction}
          isAnimatingOut={isAnimatingOut}
        />
      </View>
    </Modal>
  );
}

type PopupCardProps = {
  request: PushRequest;
  totalPending: number;
  onAction: (action: "accept" | "decline") => void;
  isAnimatingOut: boolean;
};

function PopupCard({
  request,
  totalPending,
  onAction,
  isAnimatingOut,
}: PopupCardProps) {
  const { t } = useLingui();
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const token = useTokenStore((state) =>
    state.tokens.find((candidate) => candidate.id === request.serial),
  );
  const scale = useSharedValue(0.96);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withTiming(1, {
      duration: 280,
      easing: Easing.out(Easing.quad),
    });
    opacity.value = withTiming(1, { duration: 240 });
  }, [opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  const service = getServiceName(request.url);
  const receivedAt = useMemo(
    () =>
      new Date(request.sentAt).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [request.sentAt],
  );
  const organizationName = token?.issuer ?? token?.label;
  const context = [
    ...new Set(
      [token?.label, service, receivedAt].filter(
        (value): value is string =>
          Boolean(value) && value !== organizationName,
      ),
    ),
  ];
  const cardWidth = Math.min(width - Spacing.xl * 2, 420);
  const cardMaxHeight = Math.max(320, height - Spacing.xl * 2);

  return (
    <Animated.View
      style={[
        styles.popup,
        {
          backgroundColor: theme.background,
          borderColor: theme.border,
          width: cardWidth,
          maxHeight: cardMaxHeight,
        },
        animatedStyle,
      ]}
      entering={FadeIn.duration(240)}
      exiting={FadeOut.duration(200)}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        bounces={false}
        contentContainerStyle={styles.scrollContent}
      >
        <TokenImage
          imageUrl={token?.imageUrl}
          label={organizationName}
          size="medium"
          animated
          style={styles.organizationLogo}
        />

        <View style={styles.heading}>
          <ThemedText
            selectable
            fontSize={Typography.fontSize24}
            fontWeight="bold"
            style={styles.centeredText}
          >
            {t`Review sign-in`}
          </ThemedText>
          {organizationName ? (
            <ThemedText
              selectable
              fontSize={Typography.fontSize14}
              themeColor="textSecondary"
              style={styles.centeredText}
            >
              {organizationName}
            </ThemedText>
          ) : null}
        </View>

        {request.title || request.question || context.length > 0 ? (
          <View
            style={[
              styles.requestMessage,
              {
                backgroundColor: theme.backgroundSecondary,
                borderColor: theme.border,
              },
            ]}
          >
            {request.title ? (
              <ThemedText
                selectable
                fontSize={Typography.fontSize16}
                fontWeight="semiBold"
              >
                {request.title}
              </ThemedText>
            ) : null}
            {request.question ? (
              <ThemedText
                selectable
                fontSize={Typography.fontSize14}
                themeColor="textSecondary"
              >
                {request.question}
              </ThemedText>
            ) : null}
            {context.length > 0 ? (
              <ThemedText
                selectable
                fontSize={Typography.fontSize12}
                themeColor="textSecondary"
                numberOfLines={2}
              >
                {context.join(" · ")}
              </ThemedText>
            ) : null}
          </View>
        ) : null}

        <View
          style={[
            styles.guidance,
            {
              backgroundColor: theme.dangerBackground,
              borderColor: theme.dangerBar,
            },
          ]}
        >
          <ThemedText selectable fontSize={Typography.fontSize14}>
            {t`Only approve if you started this sign-in. If you are unsure, deny it.`}
          </ThemedText>
        </View>

        {totalPending > 1 ? (
          <ThemedText
            selectable
            fontSize={Typography.fontSize12}
            themeColor="textSecondary"
            style={styles.centeredText}
          >
            {t`${totalPending} requests are waiting. Review each one separately.`}
          </ThemedText>
        ) : null}

        <View style={styles.buttonContainer}>
          <ActionButton
            label={t`Deny`}
            onPress={() => onAction("decline")}
            disabled={isAnimatingOut}
          />
          <ActionButton
            label={t`Approve`}
            onPress={() => onAction("accept")}
            disabled={isAnimatingOut}
          />
        </View>
      </ScrollView>
    </Animated.View>
  );
}

function getServiceName(value: string): string | undefined {
  if (!value) return undefined;

  try {
    return new URL(value).hostname;
  } catch {
    return undefined;
  }
}

function ActionButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  const theme = useTheme();
  const pressScale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.button,
        {
          backgroundColor: theme.fill,
          borderColor: theme.border,
        },
        animatedStyle,
        disabled && styles.buttonDisabled,
      ]}
      onPress={onPress}
      onPressIn={() => pressScale.set(withTiming(0.97, { duration: 100 }))}
      onPressOut={() => pressScale.set(withTiming(1, { duration: 100 }))}
      disabled={disabled}
    >
      <ThemedText
        selectable
        fontSize={Typography.fontSize16}
        fontWeight="semiBold"
        style={styles.centeredText}
      >
        {label}
      </ThemedText>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderCurve: "continuous",
    borderRadius: Radii.lg,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  centeredText: {
    textAlign: "center",
  },
  container: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  guidance: {
    borderCurve: "continuous",
    borderLeftWidth: 3,
    borderRadius: Radii.md,
    gap: Spacing.xs,
    padding: Spacing.md,
  },
  heading: {
    gap: Spacing.xs,
  },
  organizationLogo: {
    alignSelf: "center",
    marginRight: 0,
  },
  popup: {
    borderCurve: "continuous",
    borderRadius: Radii.xl,
    borderWidth: 1,
    boxShadow: "0 12px 36px rgba(0, 0, 0, 0.24)",
    overflow: "hidden",
  },
  requestMessage: {
    borderCurve: "continuous",
    borderRadius: Radii.lg,
    borderWidth: 1,
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  scrollContent: {
    gap: Spacing.lg,
    padding: Spacing.lg,
  },
});
