import { ThemedText } from "@/components/themed-text";
import { Spacing, Typography } from "@/constants/theme";
import { OPEN_SOURCE_LICENSES } from "@/generated/open-source-licenses";
import { Trans, useLingui } from "@lingui/react/macro";
import * as Linking from "expo-linking";
import { Stack, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function LicenseScreen() {
  const { t } = useLingui();
  const { bottom } = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const item = OPEN_SOURCE_LICENSES.find((license) => license.id === id);

  if (!item) {
    return (
      <>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Spacing.xl * 2 + bottom },
          ]}
        >
          <ThemedText selectable>
            <Trans>License information is unavailable.</Trans>
          </ThemedText>
        </ScrollView>
        <Stack.Screen.Title>{t`License`}</Stack.Screen.Title>
      </>
    );
  }

  const itemLicense = item.license;
  const itemVersion = item.version;

  return (
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Spacing.xl * 2 + bottom },
        ]}
      >
        <ThemedText fontSize={Typography.fontSize20} fontWeight="semiBold">
          {item.name}
        </ThemedText>
        <ThemedText selectable themeColor="textSecondary">
          <Trans>
            Version {itemVersion} · {itemLicense}
          </Trans>
        </ThemedText>
        {item.url ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => void Linking.openURL(item.url)}
          >
            <ThemedText style={styles.link} themeColor="branding">
              <Trans>Project website</Trans>
            </ThemedText>
          </Pressable>
        ) : null}
        <ThemedText selectable style={styles.licenseText}>
          {item.licenseText}
        </ThemedText>
      </ScrollView>
      <Stack.Screen.Title>{item.name}</Stack.Screen.Title>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  licenseText: {
    fontFamily: "ui-monospace",
    lineHeight: 21,
    paddingTop: Spacing.md,
  },
  link: {
    paddingVertical: Spacing.sm,
  },
});
