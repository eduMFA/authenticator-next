import { ThemedText } from "@/components/themed-text";
import { Spacing, Typography } from "@/constants/theme";
import { OPEN_SOURCE_LICENSES } from "@/generated/open-source-licenses";
import * as Linking from "expo-linking";
import { Stack, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet } from "react-native";

export default function LicenseScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const item = OPEN_SOURCE_LICENSES.find((license) => license.id === id);

  if (!item) {
    return (
      <>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.content}
        >
          <ThemedText selectable>
            License information is unavailable.
          </ThemedText>
        </ScrollView>
        <Stack.Screen.Title>License</Stack.Screen.Title>
      </>
    );
  }

  return (
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        <ThemedText fontSize={Typography.fontSize20} fontWeight="semiBold">
          {item.name}
        </ThemedText>
        <ThemedText selectable themeColor="textSecondary">
          Version {item.version} · {item.license}
        </ThemedText>
        {item.url ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => void Linking.openURL(item.url)}
          >
            <ThemedText style={styles.link} themeColor="branding">
              Project website
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
    paddingBottom: Spacing.xl * 2,
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
