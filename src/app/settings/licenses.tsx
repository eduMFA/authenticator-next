import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { OPEN_SOURCE_LICENSES } from "@/generated/open-source-licenses";
import { useTheme } from "@/hooks/use-theme";
import { Trans, useLingui } from "@lingui/react/macro";
import { Stack, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { FlatList, Pressable, StyleSheet, View } from "react-native";

export default function LicensesScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useLingui();
  const licenseCount = OPEN_SOURCE_LICENSES.length;

  return (
    <>
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        data={OPEN_SOURCE_LICENSES}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <ThemedText style={styles.intro} themeColor="textSecondary">
            <Trans>
              eduMFA uses {licenseCount} open-source packages. Package details
              are generated from the installed production dependency graph.
            </Trans>
          </ThemedText>
        }
        ItemSeparatorComponent={() => (
          <ThemedView type="border" style={styles.divider} />
        )}
        renderItem={({ item, index }) => (
          <ThemedView
            type="backgroundSecondary"
            style={[
              index === 0 && styles.firstRow,
              index === OPEN_SOURCE_LICENSES.length - 1 && styles.lastRow,
            ]}
          >
            <Pressable
              onPress={() => {
                router.navigate({
                  pathname: "/settings/license",
                  params: { id: item.id },
                });
              }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.name}>
                <ThemedText>{item.name}</ThemedText>
                <ThemedText
                  fontSize={Typography.fontSize12}
                  themeColor="textSecondary"
                >
                  {item.version}
                </ThemedText>
              </View>
              <View style={styles.detail}>
                <ThemedText
                  fontSize={Typography.fontSize14}
                  themeColor="textSecondary"
                >
                  {item.license}
                </ThemedText>
              </View>
              <SymbolView
                name="chevron.right"
                size={14}
                tintColor={theme.textSecondary}
              />
            </Pressable>
          </ThemedView>
        )}
      />
      <Stack.Screen.Title>{t`Open-source licenses`}</Stack.Screen.Title>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl * 2,
  },
  detail: {
    alignItems: "flex-end",
    maxWidth: "45%",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Spacing.lg,
  },
  firstRow: {
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
  },
  intro: {
    paddingBottom: Spacing.lg,
  },
  lastRow: {
    borderBottomLeftRadius: Radii.xl,
    borderBottomRightRadius: Radii.xl,
  },
  name: {
    flex: 1,
    gap: Spacing.xxs,
  },
  pressed: {
    opacity: 0.55,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.md,
    minHeight: 52,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
});
