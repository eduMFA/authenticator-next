import { StatusCard } from "@/components/status-card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { TokenImage } from "@/components/token-image";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  PushToken,
  PushTokenRefreshStatus,
  PushTokenRolloutState,
} from "@/types";
import { Button, Host } from "@expo/ui/swift-ui";
import { buttonStyle, controlSize } from "@expo/ui/swift-ui/modifiers";
import { useLingui } from "@lingui/react/macro";
import { StyleSheet, View } from "react-native";
import {
  formatTimestamp,
  getRolloutFailureDetails,
  getRolloutStateLabel,
  prettifyRefreshError,
} from "./token-detail-utils";

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

export function TokenOverviewContent({
  token,
  onRetryRollout,
}: {
  token: PushToken;
  onRetryRollout: () => void;
}) {
  const { t } = useLingui();
  const theme = useTheme();
  const isRolloutFailed = PushTokenRolloutState.isFailed(token.rolloutState);
  const rolloutFailureDetails = getRolloutFailureDetails(token.rolloutState);
  const refreshResult = token.lastRefreshResult;
  const hasRefreshFailure =
    refreshResult?.status === PushTokenRefreshStatus.Failed;
  const refreshFailedAt = formatTimestamp(refreshResult?.timestamp);
  const refreshFailureDetails = prettifyRefreshError(refreshResult?.error);

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
          title={rolloutFailureDetails.title}
          description={rolloutFailureDetails.description}
        >
          <View style={styles.nativeButton}>
            <Host matchContents>
              <Button
                label={t`Retry rollout`}
                systemImage="arrow.clockwise"
                onPress={onRetryRollout}
                modifiers={[controlSize("large"), buttonStyle("glass")]}
              />
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
          <DetailRow
            label={t`Status`}
            value={getRolloutStateLabel(token.rolloutState)}
          />
          <DetailRow label={t`Serial`} value={token.id} />
        </ThemedView>
      </View>

      <View style={styles.section}>
        <ThemedText fontSize={Typography.fontSize18} fontWeight="bold">
          {t`Audit log`}
        </ThemedText>
        <ThemedView type="backgroundSecondary" style={styles.auditPlaceholder}>
          <ThemedText fontSize={Typography.fontSize16} fontWeight="semiBold">
            {t`No interactions yet`}
          </ThemedText>
          <ThemedText
            themeColor="textSecondary"
            fontSize={Typography.fontSize14}
            style={styles.auditDescription}
          >
            {t`Token approvals, denials, refresh events, and enrollment activity will appear here.`}
          </ThemedText>
        </ThemedView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  auditDescription: {
    lineHeight: 20,
    marginTop: Spacing.xs,
    textAlign: "center",
  },
  auditPlaceholder: {
    alignItems: "center",
    borderRadius: Radii.xl,
    justifyContent: "center",
    minHeight: 132,
    padding: Spacing.xl,
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
  statusMeta: {
    marginTop: Spacing.md,
  },
});
