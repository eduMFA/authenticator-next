import { ThemedView } from "@/components/themed-view";
import { SettingsLinks } from "@/constants/settings-links";
import { Spacing } from "@/constants/theme";
import { useLingui } from "@lingui/react/macro";
import { Column, Host, ListItem, Switch, Text } from "@expo/ui/jetpack-compose";
import { clickable, paddingAll } from "@expo/ui/jetpack-compose/modifiers";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { Stack } from "expo-router";
import { useState } from "react";
import { StyleSheet } from "react-native";

export function AboutSettingsScreen() {
  const { t } = useLingui();
  const [crashReportsEnabled, setCrashReportsEnabled] = useState(true);
  const version = Constants.expoConfig?.version ?? "1.0.0";

  return (
    <>
      <Stack.Screen options={{ title: t`About` }} />
      <ThemedView style={styles.screen}>
        <Host style={styles.screen} useViewportSizeMeasurement>
          <Column modifiers={[paddingAll(Spacing.lg)]}>
            <ListItem>
              <ListItem.HeadlineContent>
                <Text>eduMFA</Text>
              </ListItem.HeadlineContent>
              <ListItem.SupportingContent>
                <Text>{t`Version ${version}`}</Text>
              </ListItem.SupportingContent>
            </ListItem>

            <ListItem
              modifiers={[
                clickable(() => {
                  openUrl(SettingsLinks.review);
                }),
              ]}
            >
              <ListItem.HeadlineContent>
                <Text>{t`Write a Review`}</Text>
              </ListItem.HeadlineContent>
            </ListItem>

            <ListItem
              modifiers={[
                clickable(() => {
                  openUrl(SettingsLinks.privacyPolicy);
                }),
              ]}
            >
              <ListItem.HeadlineContent>
                <Text>{t`Privacy Policy`}</Text>
              </ListItem.HeadlineContent>
            </ListItem>

            <ListItem
              modifiers={[
                clickable(() => {
                  openUrl(SettingsLinks.github);
                }),
              ]}
            >
              <ListItem.HeadlineContent>
                <Text>{t`GitHub`}</Text>
              </ListItem.HeadlineContent>
            </ListItem>

            <ListItem
              modifiers={[
                clickable(() => {
                  openUrl(SettingsLinks.website);
                }),
              ]}
            >
              <ListItem.HeadlineContent>
                <Text>{t`Website`}</Text>
              </ListItem.HeadlineContent>
            </ListItem>

            <ListItem>
              <ListItem.HeadlineContent>
                <Text>{t`Crash Reports`}</Text>
              </ListItem.HeadlineContent>
              <ListItem.TrailingContent>
                <Switch
                  value={crashReportsEnabled}
                  onCheckedChange={setCrashReportsEnabled}
                />
              </ListItem.TrailingContent>
            </ListItem>
          </Column>
        </Host>
      </ThemedView>
    </>
  );
}

function openUrl(url: string) {
  Linking.openURL(url);
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
});
