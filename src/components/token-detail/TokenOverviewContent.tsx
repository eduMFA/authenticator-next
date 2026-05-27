import { ThemedText, ThemedView } from "@/components/Themed";
import { TokenImage } from "@/components/TokenImage";
import { theme } from "@/theme";
import {
  PushToken,
  PushTokenRefreshStatus,
  PushTokenRolloutState,
} from "@/types";
import { Button, Host } from "@expo/ui/swift-ui";
import { buttonStyle, controlSize } from "@expo/ui/swift-ui/modifiers";
import { useLingui } from "@lingui/react/macro";
import { StyleSheet, View } from "react-native";
import { TokenStatusCard } from "./TokenStatusCard";
import {
  formatTimestamp,
  getRolloutFailureDetails,
  getRolloutStateLabel,
  prettifyRefreshError,
} from "./token-detail-utils";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <ThemedText color={theme.color.textSecondary} fontSize={theme.fontSize14}>
        {label}
      </ThemedText>
      <ThemedText
        fontSize={theme.fontSize16}
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
          fontSize={theme.fontSize28}
          fontWeight="bold"
          style={styles.heroTitle}
        >
          {token.label}
        </ThemedText>
        {token.issuer ? (
          <ThemedText
            color={theme.color.textSecondary}
            fontSize={theme.fontSize16}
            fontWeight="medium"
            style={styles.heroIssuer}
          >
            {token.issuer}
          </ThemedText>
        ) : null}
      </View>

      {isRolloutFailed ? (
        <TokenStatusCard
          tone="danger"
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
        </TokenStatusCard>
      ) : null}

      {hasRefreshFailure ? (
        <TokenStatusCard
          tone="danger"
          title={t`Refresh failed`}
          description={refreshFailureDetails.message}
        >
          {refreshFailureDetails.serverMessage ? (
            <View style={styles.serverError}>
              <ThemedText
                color={theme.color.textSecondary}
                fontSize={theme.fontSize12}
                fontWeight="semiBold"
              >
                {t`Server message`}
              </ThemedText>
              <ThemedText
                color={theme.color.text}
                fontSize={theme.fontSize14}
                style={styles.serverErrorMessage}
              >
                {refreshFailureDetails.serverMessage}
              </ThemedText>
            </View>
          ) : null}
          {refreshFailedAt ? (
            <ThemedText
              color={theme.color.textSecondary}
              fontSize={theme.fontSize12}
              style={styles.statusMeta}
            >
              {t`Last failed`} {refreshFailedAt}
            </ThemedText>
          ) : null}
        </TokenStatusCard>
      ) : null}

      <View style={styles.section}>
        <ThemedText fontSize={theme.fontSize18} fontWeight="bold">
          {t`Details`}
        </ThemedText>
        <ThemedView
          color={theme.color.backgroundSecondary}
          style={styles.detailsCard}
        >
          <DetailRow
            label={t`Status`}
            value={getRolloutStateLabel(token.rolloutState)}
          />
          <DetailRow label={t`Serial`} value={token.id} />
        </ThemedView>
      </View>

      <View style={styles.section}>
        <ThemedText fontSize={theme.fontSize18} fontWeight="bold">
          {t`Audit log`}
        </ThemedText>
        <ThemedView
          color={theme.color.backgroundSecondary}
          style={styles.auditPlaceholder}
        >
          <ThemedText fontSize={theme.fontSize16} fontWeight="semiBold">
            {t`No interactions yet`}
          </ThemedText>
          <ThemedText
            color={theme.color.textSecondary}
            fontSize={theme.fontSize14}
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
    marginTop: theme.space4,
    textAlign: "center",
  },
  auditPlaceholder: {
    alignItems: "center",
    borderRadius: theme.borderRadius20,
    justifyContent: "center",
    minHeight: 132,
    padding: theme.space24,
  },
  detailRow: {
    gap: theme.space4,
    paddingVertical: theme.space12,
  },
  detailValue: {
    lineHeight: 22,
  },
  detailsCard: {
    borderRadius: theme.borderRadius20,
    paddingHorizontal: theme.space16,
  },
  hero: {
    alignItems: "center",
    gap: theme.space4,
    paddingTop: theme.space12,
  },
  heroImage: {
    marginBottom: theme.space16,
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
    marginTop: theme.space16,
  },
  section: {
    gap: theme.space12,
  },
  serverError: {
    borderLeftColor: theme.color.errorBar.light,
    borderLeftWidth: 2,
    gap: theme.space4,
    marginTop: theme.space12,
    paddingLeft: theme.space12,
  },
  serverErrorMessage: {
    lineHeight: 20,
  },
  statusMeta: {
    marginTop: theme.space12,
  },
});
