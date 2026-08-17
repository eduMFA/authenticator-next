import { StatusCard } from "@/components/status-card";
import { ThemedPressable } from "@/components/themed-pressable";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { TokenImage } from "@/components/token-image";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useActivityStore } from "@/stores/activity";
import { ActivityType, type Activity } from "@/types/activity";
import {
  PushTokenRefreshStatus,
  PushTokenRolloutState,
  type PushToken,
} from "@/types/token";
import ForwardMediaSymbol from "@expo/material-symbols/forward_media.xml";
import { Button, Host, Icon, Row, Text } from "@expo/ui";
import { buttonStyle, controlSize } from "@expo/ui/swift-ui/modifiers";
import { useLingui } from "@lingui/react/macro";
import { useCallback, useMemo, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import {
  formatTimestamp,
  getRolloutFailureDetails,
  getRolloutStateLabel,
  prettifyRefreshError,
  refreshErrorMessages,
} from "./token-detail-utils";

const ACTIVITY_PAGE_SIZE = 20;

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <ThemedText themeColor="textSecondary" fontSize={Typography.fontSize14}>
        {label}
      </ThemedText>
      <ThemedText
        fontSize={Typography.fontSize16}
        fontWeight="semiBold"
        style={styles.detailValue}
      >
        {value}
      </ThemedText>
    </View>
  );
}

function ActivityRow({ activity }: { activity: Activity }) {
  const { t } = useLingui();
  const theme = useTheme();
  const content = {
    [ActivityType.EnrollmentStarted]: {
      label: t`Enrollment started`,
      color: theme.branding,
    },
    [ActivityType.EnrollmentCompleted]: {
      label: t`Enrollment completed`,
      color: theme.successBar,
    },
    [ActivityType.EnrollmentFailed]: {
      label: t`Enrollment failed`,
      color: theme.error,
    },
    [ActivityType.PushReceived]: {
      label: t`Push request received`,
      color: theme.branding,
    },
    [ActivityType.PushApproved]: {
      label: t`Push request approved`,
      color: theme.successBar,
    },
    [ActivityType.PushDenied]: {
      label: t`Push request denied`,
      color: theme.error,
    },
  } satisfies Record<
    ActivityType,
    { label: string; color: (typeof theme)["branding"] }
  >;
  const event = content[activity.type];
  const timestamp = new Date(activity.timestamp).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <View style={styles.activityRow}>
      <View style={[styles.activityDot, { backgroundColor: event.color }]} />
      <View style={styles.activityContent}>
        <ThemedText fontSize={Typography.fontSize14} fontWeight="semiBold">
          {event.label}
        </ThemedText>
        {activity.title ? (
          <ThemedText
            themeColor="textSecondary"
            fontSize={Typography.fontSize12}
            numberOfLines={1}
          >
            {activity.title}
          </ThemedText>
        ) : null}
        <ThemedText themeColor="textSecondary" fontSize={Typography.fontSize12}>
          {timestamp}
        </ThemedText>
      </View>
    </View>
  );
}

export function TokenOverviewContent({
  token,
  onRetryRollout,
}: {
  token: PushToken;
  onRetryRollout: () => void;
}) {
  const { i18n, t } = useLingui();
  const theme = useTheme();
  const allActivities = useActivityStore((state) => state.activities);
  const clearTokenActivities = useActivityStore(
    (state) => state.clearTokenActivities,
  );
  const [visibleActivityCount, setVisibleActivityCount] =
    useState(ACTIVITY_PAGE_SIZE);
  const activities = useMemo(
    () => allActivities.filter((activity) => activity.tokenId === token.id),
    [allActivities, token.id],
  );
  const visibleActivities = activities.slice(0, visibleActivityCount);
  const hasOlderActivities = visibleActivities.length < activities.length;
  const isRolloutFailed = PushTokenRolloutState.isFailed(token.rolloutState);
  const rolloutFailureDetails = getRolloutFailureDetails(token.rolloutState);
  const rolloutStateLabel = getRolloutStateLabel(token.rolloutState);
  const refreshResult = token.lastRefreshResult;
  const hasRefreshFailure =
    refreshResult?.status === PushTokenRefreshStatus.Failed;
  const refreshFailedAt = formatTimestamp(refreshResult?.timestamp);
  const refreshFailureDetails = prettifyRefreshError(
    refreshResult?.error,
    refreshResult?.errorType,
    {
      defaultMessage: i18n._(refreshErrorMessages.defaultMessage),
      networkMessage: i18n._(refreshErrorMessages.networkMessage),
    },
  );
  const confirmClearActivityLog = useCallback(() => {
    Alert.alert(
      t`Clear activity log?`,
      t`This permanently removes all activity for this token.`,
      [
        { text: t`Cancel`, style: "cancel" },
        {
          text: t`Clear`,
          style: "destructive",
          onPress: () => {
            clearTokenActivities(token.id);
            setVisibleActivityCount(ACTIVITY_PAGE_SIZE);
          },
        },
      ],
    );
  }, [clearTokenActivities, t, token.id]);

  return (
    <>
      <View style={styles.hero}>
        <TokenImage
          imageUrl={token.imageUrl}
          label={token.label}
          size="large"
          style={styles.heroImage}
          animated
        />
        <ThemedText
          fontSize={Typography.fontSize28}
          fontWeight="bold"
          style={styles.heroTitle}
        >
          {token.label}
        </ThemedText>
        {token.issuer ? (
          <ThemedText
            themeColor="textSecondary"
            fontSize={Typography.fontSize16}
            fontWeight="medium"
            style={styles.heroIssuer}
          >
            {token.issuer}
          </ThemedText>
        ) : null}
      </View>

      {isRolloutFailed ? (
        <StatusCard
          variant="error"
          title={i18n._(rolloutFailureDetails.title)}
          description={i18n._(rolloutFailureDetails.description)}
        >
          <View style={styles.nativeButton}>
            <Host matchContents>
              <Button
                label={t`Retry Rollout`}
                onPress={onRetryRollout}
                modifiers={[controlSize("regular"), buttonStyle("glass")]}
              >
                <Row alignment="center" spacing={6}>
                  <Icon
                    name={Icon.select({
                      ios: "arrow.clockwise",
                      android: ForwardMediaSymbol,
                    })}
                    accessibilityLabel={t`Retry Rollout`}
                  />
                  <Text numberOfLines={1}>{t`Retry Rollout`}</Text>
                </Row>
              </Button>
            </Host>
          </View>
        </StatusCard>
      ) : null}

      {hasRefreshFailure ? (
        <StatusCard
          variant="error"
          title={t`Refresh failed`}
          description={refreshFailureDetails.message}
        >
          {refreshFailureDetails.serverMessage ? (
            <View
              style={[styles.serverError, { borderLeftColor: theme.errorBar }]}
            >
              <ThemedText
                themeColor="textSecondary"
                fontSize={Typography.fontSize12}
                fontWeight="semiBold"
              >
                {t`Server message`}
              </ThemedText>
              <ThemedText
                themeColor="text"
                fontSize={Typography.fontSize14}
                style={styles.serverErrorMessage}
              >
                {refreshFailureDetails.serverMessage}
              </ThemedText>
            </View>
          ) : null}
          {refreshFailedAt ? (
            <ThemedText
              themeColor="textSecondary"
              fontSize={Typography.fontSize12}
              style={styles.statusMeta}
            >
              {t`Last failed`} {refreshFailedAt}
            </ThemedText>
          ) : null}
        </StatusCard>
      ) : null}

      <View style={styles.section}>
        <ThemedText fontSize={Typography.fontSize18} fontWeight="bold">
          {t`Details`}
        </ThemedText>
        <ThemedView type="backgroundSecondary" style={styles.detailsCard}>
          <DetailRow label={t`Status`} value={i18n._(rolloutStateLabel)} />
          <DetailRow label={t`Serial`} value={token.id} />
        </ThemedView>
      </View>

      <View style={styles.section}>
        <View style={styles.activityHeader}>
          <ThemedText fontSize={Typography.fontSize18} fontWeight="bold">
            {t`Activity Log`}
          </ThemedText>
          {activities.length > 0 ? (
            <ThemedPressable
              accessibilityRole="button"
              onPress={confirmClearActivityLog}
              style={({ pressed }) => [
                styles.clearActivityButton,
                { opacity: pressed ? 0.65 : 1 },
              ]}
              type="errorBackground"
            >
              <ThemedText
                fontSize={Typography.fontSize12}
                fontWeight="semiBold"
                themeColor="error"
              >
                {t`Clear`}
              </ThemedText>
            </ThemedPressable>
          ) : null}
        </View>
        <ThemedView type="backgroundSecondary" style={styles.activityCard}>
          {activities.length > 0 ? (
            <>
              {visibleActivities.map((activity) => (
                <ActivityRow key={activity.id} activity={activity} />
              ))}
              {hasOlderActivities ? (
                <ThemedPressable
                  accessibilityRole="button"
                  onPress={() =>
                    setVisibleActivityCount((count) =>
                      Math.min(count + ACTIVITY_PAGE_SIZE, activities.length),
                    )
                  }
                  style={({ pressed }) => [
                    styles.showOlderButton,
                    { opacity: pressed ? 0.65 : 1 },
                  ]}
                  type="fill"
                >
                  <ThemedText
                    fontSize={Typography.fontSize14}
                    fontWeight="semiBold"
                  >
                    {t`Show older activity`}
                  </ThemedText>
                </ThemedPressable>
              ) : null}
            </>
          ) : (
            <View style={styles.auditPlaceholder}>
              <ThemedText
                fontSize={Typography.fontSize16}
                fontWeight="semiBold"
              >
                {t`No interactions yet`}
              </ThemedText>
              <ThemedText
                themeColor="textSecondary"
                fontSize={Typography.fontSize14}
                style={styles.auditDescription}
              >
                {t`Token approvals, denials, push requests, and enrollment activity will appear here.`}
              </ThemedText>
            </View>
          )}
        </ThemedView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  activityCard: {
    borderRadius: Radii.xl,
    paddingHorizontal: Spacing.lg,
  },
  activityContent: {
    flex: 1,
    gap: Spacing.xxs,
  },
  activityDot: {
    borderRadius: 5,
    height: 10,
    marginTop: Spacing.xs,
    width: 10,
  },
  activityHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  activityRow: {
    flexDirection: "row",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  auditDescription: {
    lineHeight: 20,
    marginTop: Spacing.xs,
    textAlign: "center",
  },
  auditPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 132,
    padding: Spacing.xl,
  },
  clearActivityButton: {
    alignItems: "center",
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  detailRow: {
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
  },
  detailValue: {
    lineHeight: 22,
  },
  detailsCard: {
    borderRadius: Radii.xl,
    paddingHorizontal: Spacing.lg,
  },
  hero: {
    alignItems: "center",
    gap: Spacing.xs,
    paddingTop: Spacing.md,
  },
  heroImage: {
    marginBottom: Spacing.lg,
    marginRight: 0,
  },
  heroIssuer: {
    textAlign: "center",
  },
  heroTitle: {
    textAlign: "center",
  },
  nativeButton: {
    alignItems: "flex-start",
    marginTop: Spacing.lg,
  },
  section: {
    gap: Spacing.md,
  },
  serverError: {
    borderLeftWidth: 2,
    gap: Spacing.xs,
    marginTop: Spacing.md,
    paddingLeft: Spacing.md,
  },
  serverErrorMessage: {
    lineHeight: 20,
  },
  showOlderButton: {
    alignItems: "center",
    borderRadius: Radii.lg,
    marginBottom: Spacing.lg,
    marginTop: Spacing.sm,
    padding: Spacing.md,
  },
  statusMeta: {
    marginTop: Spacing.md,
  },
});
