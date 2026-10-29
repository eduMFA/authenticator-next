import { Radii, Spacing, Typography } from "@/constants/theme";
import type { PushAuthResponse } from "@/services/push-auth";
import { useTheme } from "@/hooks/use-theme";
import { usePushRequestStore } from "@/stores/push-request";
import { useTokenStore } from "@/stores/token";
import type { PushRequest } from "@/types/push-request";
import { PushRequestStatus } from "@/types/push-request";
import { playImpactLightHaptic, playImpactMediumHaptic } from "@/utils/haptics";
import { useLingui } from "@lingui/react/macro";
import { BlurView } from "expo-blur";
import { SymbolView } from "expo-symbols";
import {
  type ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useColorScheme,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
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
  onAction: (request: PushRequest) => Promise<PushAuthResponse>;
};

export function PushRequestPopup({
  requests,
  onAction,
}: PushRequestPopupProps) {
  const pendingRequests = requests.filter(
    (request) => request.status === PushRequestStatus.Pending,
  );
  const currentRequest = pendingRequests[0];
  if (!currentRequest) return null;
  return (
    <PushRequestSession
      key={currentRequest.id}
      currentRequest={currentRequest}
      totalPending={pendingRequests.length}
      onAction={onAction}
    />
  );
}

function PushRequestSession({
  currentRequest,
  totalPending,
  onAction,
}: {
  currentRequest: PushRequest;
  totalPending: number;
  onAction: PushRequestPopupProps["onAction"];
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<PushAuthResponse>();
  const [submittedStatus, setSubmittedStatus] = useState(
    PushRequestStatus.Accepted,
  );
  const colorScheme = useColorScheme();
  const { updatePushRequestStatus } = usePushRequestStore();

  const dismissFeedback = useCallback(() => {
    if (feedback?.success || feedback?.challengeMatched === false) {
      updatePushRequestStatus(
        currentRequest.id,
        feedback.challengeMatched === false
          ? PushRequestStatus.ChallengeMismatch
          : submittedStatus,
      );
    }
    setFeedback(undefined);
  }, [currentRequest, feedback, submittedStatus, updatePushRequestStatus]);

  const handleAction = useCallback(
    async (action: "accept" | "decline", challengeResponse?: string) => {
      if (isSubmitting || feedback) return;
      const status =
        action === "accept"
          ? PushRequestStatus.Accepted
          : PushRequestStatus.Declined;
      if (action === "accept") playImpactMediumHaptic();
      else playImpactLightHaptic();
      setIsSubmitting(true);
      setSubmittedStatus(status);
      try {
        const result = await onAction({
          ...currentRequest,
          status,
          challenge_response: challengeResponse,
        });
        setFeedback(result);
      } catch {
        setFeedback({ success: false });
      } finally {
        setIsSubmitting(false);
      }
    },
    [currentRequest, feedback, isSubmitting, onAction],
  );

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {
        if (feedback) dismissFeedback();
        else void handleAction("decline");
      }}
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
          key={currentRequest.id}
          request={currentRequest}
          totalPending={totalPending}
          onAction={handleAction}
          isSubmitting={isSubmitting}
          feedback={feedback}
          submittedStatus={submittedStatus}
          onDismiss={dismissFeedback}
        />
      </View>
    </Modal>
  );
}

type PopupCardProps = {
  request: PushRequest;
  totalPending: number;
  onAction: (action: "accept" | "decline", challengeResponse?: string) => void;
  feedback?: PushAuthResponse;
  submittedStatus: PushRequestStatus;
  onDismiss: () => void;
  isSubmitting: boolean;
};

function PopupCard({
  request,
  totalPending,
  onAction,
  isSubmitting,
  feedback,
  submittedStatus,
  onDismiss,
}: PopupCardProps) {
  const { t } = useLingui();
  const theme = useTheme();
  const [selectedChoice, setSelectedChoice] = useState<string>();
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
      layout={LinearTransition.duration(220)}
      entering={FadeIn.duration(240)}
      exiting={FadeOut.duration(200)}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        bounces={false}
        contentContainerStyle={styles.scrollContent}
      >
        {feedback ? (
          <PushRequestResult
            feedback={feedback}
            declined={submittedStatus === PushRequestStatus.Declined}
            hasChallenge={Boolean(request.challenge_type)}
            organizationName={organizationName}
            onDismiss={onDismiss}
          />
        ) : (
          <Animated.View
            key="review"
            entering={FadeIn.duration(180)}
            style={styles.reviewContent}
          >
            <View style={styles.organization}>
              <TokenImage
                imageUrl={token?.imageUrl}
                label={organizationName}
                size="small"
                style={styles.organizationLogo}
              />
              <View style={styles.organizationText}>
                <ThemedText
                  fontSize={Typography.fontSize14}
                  fontWeight="semiBold"
                >
                  {organizationName ?? service}
                </ThemedText>
                <ThemedText
                  fontSize={Typography.fontSize12}
                  themeColor="textSecondary"
                >
                  {context.join(" · ")}
                </ThemedText>
              </View>
            </View>
            <View style={styles.heading}>
              <ThemedText
                fontSize={Typography.fontSize28}
                fontWeight="bold"
                style={styles.centeredText}
              >
                {request.challenge_type
                  ? t`Match your sign-in`
                  : t`Review sign-in`}
              </ThemedText>
              <ThemedText
                fontSize={Typography.fontSize16}
                themeColor="textSecondary"
                style={styles.centeredText}
              >
                {request.challenge_type
                  ? t`Select the number shown on your sign-in screen.`
                  : request.question}
              </ThemedText>
            </View>
            {request.challenge_type === "number" ? (
              <>
                <View style={styles.buttonContainer}>
                  {request.challenge_choices?.split(",").map((choice) => (
                    <ActionButton
                      key={choice}
                      label={choice}
                      choice
                      variant={
                        isSubmitting && selectedChoice === choice
                          ? "primary"
                          : "default"
                      }
                      onPress={() => {
                        setSelectedChoice(choice);
                        onAction("accept", choice);
                      }}
                      disabled={isSubmitting}
                    />
                  ))}
                </View>
                {request.question ? (
                  <ThemedText
                    fontSize={Typography.fontSize14}
                    themeColor="textSecondary"
                    style={styles.centeredText}
                  >
                    {request.question}
                  </ThemedText>
                ) : null}
              </>
            ) : null}
            {isSubmitting ? (
              <View style={styles.loading} accessibilityRole="alert">
                <ActivityIndicator color={theme.branding} />
                <ThemedText
                  fontSize={Typography.fontSize14}
                  themeColor="textSecondary"
                >{t`Verifying your response…`}</ThemedText>
              </View>
            ) : null}
            <View style={styles.buttonContainer}>
              <ActionButton
                label={t`Deny`}
                onPress={() => onAction("decline")}
                disabled={isSubmitting}
              />
              {!request.challenge_type ? (
                <ActionButton
                  label={t`Approve`}
                  variant="primary"
                  onPress={() => onAction("accept")}
                  disabled={isSubmitting}
                />
              ) : null}
            </View>
            <ThemedText
              fontSize={Typography.fontSize12}
              themeColor="textSecondary"
              style={styles.centeredText}
            >
              {t`Only approve if you started this sign-in. If you are unsure, deny it.`}
            </ThemedText>
            {totalPending > 1 ? (
              <ThemedText
                fontSize={Typography.fontSize12}
                themeColor="textSecondary"
                style={styles.centeredText}
              >
                {t`${totalPending} requests are waiting. Review each one separately.`}
              </ThemedText>
            ) : null}
          </Animated.View>
        )}
      </ScrollView>
    </Animated.View>
  );
}

function PushRequestResult({
  feedback,
  declined,
  hasChallenge,
  organizationName,
  onDismiss,
}: {
  feedback: PushAuthResponse;
  declined: boolean;
  hasChallenge: boolean;
  organizationName?: string;
  onDismiss: () => void;
}) {
  const { t } = useLingui();
  const theme = useTheme();
  const mismatch = feedback.challengeMatched === false;
  const approved = feedback.success && !declined;
  const terminal = feedback.success || mismatch;
  const accent = approved
    ? theme.successBar
    : mismatch
      ? theme.errorBar
      : declined && feedback.success
        ? theme.neutralBar
        : theme.dangerBar;
  const background = approved
    ? theme.successBackground
    : mismatch
      ? theme.errorBackground
      : declined && feedback.success
        ? theme.neutralBackground
        : theme.dangerBackground;
  const title = approved
    ? t`Sign-in approved`
    : mismatch
      ? t`Challenge failed`
      : feedback.success
        ? t`Sign-in denied`
        : t`Response not sent`;
  const description = approved
    ? hasChallenge
      ? t`Challenge matched. You can continue on your other screen.`
      : t`You can continue on your other screen.`
    : mismatch
      ? t`Your answer did not match. Start a new sign-in to try again.`
      : feedback.success
        ? t`This sign-in request was blocked.`
        : t`Check your connection and try again.`;
  const icon: ComponentProps<typeof SymbolView>["name"] = approved
    ? { ios: "checkmark" as const, android: "check" }
    : terminal
      ? { ios: "xmark" as const, android: "close" }
      : { ios: "wifi.exclamationmark" as const, android: "wifi_off" };

  return (
    <Animated.View
      key="result"
      entering={FadeIn.duration(220)}
      style={styles.result}
      accessibilityLiveRegion="polite"
    >
      <View style={[styles.resultIcon, { backgroundColor: background }]}>
        <SymbolView name={icon} size={52} tintColor={accent} />
      </View>
      <View style={styles.resultCopy}>
        <ThemedText
          accessibilityRole="header"
          fontSize={Typography.fontSize28}
          fontWeight="bold"
          style={styles.centeredText}
        >
          {title}
        </ThemedText>
        <ThemedText
          fontSize={Typography.fontSize16}
          themeColor="textSecondary"
          style={styles.resultDescription}
        >
          {description}
        </ThemedText>
      </View>
      {organizationName ? (
        <ThemedText
          fontSize={Typography.fontSize14}
          themeColor="textSecondary"
          style={styles.centeredText}
        >
          {organizationName}
        </ThemedText>
      ) : null}
      <View style={styles.buttonContainer}>
        <ActionButton
          label={terminal ? t`Done` : t`Try again`}
          variant="primary"
          onPress={onDismiss}
          disabled={false}
        />
      </View>
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
  choice = false,
  variant = "default",
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  choice?: boolean;
  variant?: "default" | "primary";
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
        choice && styles.choice,
        {
          backgroundColor: variant === "primary" ? theme.branding : theme.fill,
          borderColor: variant === "primary" ? theme.branding : theme.border,
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
        fontSize={choice ? Typography.fontSize32 : Typography.fontSize16}
        themeColor={variant === "primary" ? "textOnBranding" : "text"}
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
  choice: {
    borderRadius: Radii.xl,
    minHeight: 84,
    paddingHorizontal: Spacing.xs,
  },
  container: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  heading: {
    gap: Spacing.md,
  },
  loading: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.sm,
    justifyContent: "center",
  },
  organization: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.md,
  },
  organizationLogo: {
    marginRight: 0,
  },
  organizationText: {
    flex: 1,
    gap: Spacing.xs,
  },
  popup: {
    borderCurve: "continuous",
    borderRadius: Radii.xl,
    borderWidth: 1,
    boxShadow: "0 12px 36px rgba(0, 0, 0, 0.24)",
    overflow: "hidden",
  },
  result: {
    gap: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  resultCopy: {
    gap: Spacing.md,
  },
  resultDescription: {
    lineHeight: 24,
    textAlign: "center",
  },
  resultIcon: {
    alignItems: "center",
    alignSelf: "center",
    borderRadius: 56,
    height: 112,
    justifyContent: "center",
    width: 112,
  },
  reviewContent: {
    gap: Spacing.xl,
  },
  scrollContent: {
    padding: Spacing.xl,
  },
});
