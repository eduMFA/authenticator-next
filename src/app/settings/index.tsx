import { SettingsRow } from "@/components/settings-row";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { SETTINGS_LINKS } from "@/constants/settings";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useSettingsStore, type ThemePreference } from "@/stores/settings";
import { useLingui } from "@lingui/react/macro";
import * as Application from "expo-application";
import * as Linking from "expo-linking";
import { Stack, useRouter } from "expo-router";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";

function openUrl(url: string): void {
  void Linking.openURL(url);
}

export default function SettingsScreen() {
  const router = useRouter();
  const { t } = useLingui();
  const theme = useTheme();
  const crashReportsEnabled = useSettingsStore(
    (state) => state.crashReportsEnabled,
  );
  const hapticsEnabled = useSettingsStore((state) => state.hapticsEnabled);
  const themePreference = useSettingsStore((state) => state.themePreference);
  const setCrashReportsEnabled = useSettingsStore(
    (state) => state.setCrashReportsEnabled,
  );
  const setHapticsEnabled = useSettingsStore(
    (state) => state.setHapticsEnabled,
  );
  const setThemePreference = useSettingsStore(
    (state) => state.setThemePreference,
  );
  const version = Application.nativeApplicationVersion ?? "1.0.0";
  const build = Application.nativeBuildVersion;
  const themeOptions: readonly {
    label: string;
    value: ThemePreference;
  }[] = [
    { label: t`Automatic`, value: "automatic" },
    { label: t`Light`, value: "light" },
    { label: t`Dark`, value: "dark" },
  ];

  return (
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        <Section title={t`Appearance`}>
          <SettingsRow icon="circle.lefthalf.filled" label={t`Theme`} />
          <View style={styles.themeOptions}>
            {themeOptions.map((option) => {
              const selected = option.value === themePreference;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  key={option.value}
                  onPress={() => setThemePreference(option.value)}
                  style={[
                    styles.themeOption,
                    {
                      backgroundColor: selected ? theme.branding : theme.fill,
                    },
                  ]}
                >
                  <ThemedText
                    fontSize={Typography.fontSize14}
                    style={{
                      color: selected ? theme.textOnBranding : theme.text,
                    }}
                  >
                    {option.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section title={t`General`}>
          <SettingsRow
            icon="hand.tap"
            label={t`Haptics`}
            trailing={
              <Switch
                accessibilityLabel={t`Haptics`}
                onValueChange={setHapticsEnabled}
                value={hapticsEnabled}
              />
            }
          />
          <Divider />
          <SettingsRow
            detail={t`Change the app language in system settings`}
            icon="globe"
            label={t`Language`}
            onPress={() => void Linking.openSettings()}
          />
        </Section>

        <Section title={t`About`}>
          <SettingsRow
            icon="star"
            label={t`Review eduMFA`}
            onPress={() =>
              openUrl(
                Platform.OS === "ios"
                  ? SETTINGS_LINKS.reviewIos
                  : SETTINGS_LINKS.reviewAndroid,
              )
            }
          />
          <Divider />
          <SettingsRow
            icon="hand.raised"
            label={t`Privacy policy`}
            onPress={() => openUrl(SETTINGS_LINKS.privacy)}
          />
          <Divider />
          <SettingsRow
            icon="chevron.left.forwardslash.chevron.right"
            label={t`GitHub`}
            onPress={() => openUrl(SETTINGS_LINKS.github)}
          />
          <Divider />
          <SettingsRow
            icon="safari"
            label={t`Website`}
            onPress={() => openUrl(SETTINGS_LINKS.website)}
          />
          <Divider />
          <SettingsRow
            icon="doc.text"
            label={t`Open-source licenses`}
            onPress={() => router.navigate("/settings/licenses")}
          />
        </Section>

        <Section title={t`Privacy`}>
          <SettingsRow
            detail={t`Send anonymized crash and error diagnostics`}
            icon="waveform.path.ecg"
            label={t`Crash and error reports`}
            trailing={
              <Switch
                accessibilityLabel={t`Crash and error reports`}
                onValueChange={setCrashReportsEnabled}
                value={crashReportsEnabled}
              />
            }
          />
        </Section>

        <ThemedText
          fontSize={Typography.fontSize12}
          style={styles.version}
          themeColor="textSecondary"
        >
          eduMFA {version}
          {build ? ` (${build})` : ""}
        </ThemedText>
      </ScrollView>
      <Stack.Screen.Title>{t`Settings`}</Stack.Screen.Title>
    </>
  );
}

function Section({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <View style={styles.section}>
      <ThemedText
        fontSize={Typography.fontSize14}
        style={styles.sectionTitle}
        themeColor="textSecondary"
      >
        {title}
      </ThemedText>
      <ThemedView type="backgroundSecondary" style={styles.card}>
        {children}
      </ThemedView>
    </View>
  );
}

function Divider() {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.border }]} />;
}

const styles = StyleSheet.create({
  card: {
    borderCurve: "continuous",
    borderRadius: Radii.xl,
    overflow: "hidden",
  },
  content: {
    gap: Spacing.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl * 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 52,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    paddingHorizontal: Spacing.lg,
  },
  themeOption: {
    alignItems: "center",
    borderCurve: "continuous",
    borderRadius: Radii.md,
    flex: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  themeOptions: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  version: {
    textAlign: "center",
  },
});
