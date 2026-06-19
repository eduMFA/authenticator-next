import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { ThemePreference, useSettingsStore } from "@/stores/settings";
import { useLingui } from "@lingui/react/macro";
import {
  Column,
  Host,
  ListItem,
  ModalBottomSheet,
  RadioButton,
  Row,
  Switch,
  Text,
} from "@expo/ui/jetpack-compose";
import {
  clickable,
  fillMaxWidth,
  height,
  padding,
  paddingAll,
  selectable,
  selectableGroup,
} from "@expo/ui/jetpack-compose/modifiers";
import * as Linking from "expo-linking";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet } from "react-native";

type ThemeOption = {
  label: string;
  value: ThemePreference;
};

export function SettingsScreen() {
  const { t } = useLingui();
  const router = useRouter();
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const themePreference = useSettingsStore((state) => state.themePreference);
  const setThemePreference = useSettingsStore(
    (state) => state.setThemePreference,
  );
  const themeOptions: ThemeOption[] = [
    { label: t`Auto`, value: "auto" },
    { label: t`Light`, value: "light" },
    { label: t`Dark`, value: "dark" },
  ];
  const selectedThemeLabel =
    themeOptions.find((option) => option.value === themePreference)?.label ??
    t`Auto`;

  const selectTheme = (preference: ThemePreference) => {
    setThemePreference(preference);
    setThemeModalVisible(false);
  };

  return (
    <>
      <Stack.Screen options={{ title: t`Settings` }} />
      <ThemedView style={styles.screen}>
        <Host style={styles.screen} useViewportSizeMeasurement>
          <Column modifiers={[paddingAll(Spacing.lg)]}>
            <ListItem>
              <ListItem.HeadlineContent>
                <Text>{t`Haptics`}</Text>
              </ListItem.HeadlineContent>
              <ListItem.TrailingContent>
                <Switch
                  value={hapticsEnabled}
                  onCheckedChange={setHapticsEnabled}
                />
              </ListItem.TrailingContent>
            </ListItem>

            <ListItem
              modifiers={[
                clickable(() => {
                  setThemeModalVisible(true);
                }),
              ]}
            >
              <ListItem.HeadlineContent>
                <Text>{t`Theme`}</Text>
              </ListItem.HeadlineContent>
              <ListItem.SupportingContent>
                <Text>{selectedThemeLabel}</Text>
              </ListItem.SupportingContent>
            </ListItem>

            <ListItem
              modifiers={[
                clickable(() => {
                  Linking.openSettings();
                }),
              ]}
            >
              <ListItem.HeadlineContent>
                <Text>{t`Language`}</Text>
              </ListItem.HeadlineContent>
              <ListItem.SupportingContent>
                <Text>{t`Managed by your device settings`}</Text>
              </ListItem.SupportingContent>
            </ListItem>

            <ListItem
              modifiers={[
                clickable(() => {
                  router.navigate("/settings/about");
                }),
              ]}
            >
              <ListItem.HeadlineContent>
                <Text>{t`About`}</Text>
              </ListItem.HeadlineContent>
            </ListItem>

            {themeModalVisible ? (
              <ModalBottomSheet
                onDismissRequest={() => {
                  setThemeModalVisible(false);
                }}
              >
                <Column
                  modifiers={[
                    fillMaxWidth(),
                    padding(Spacing.lg, 0, Spacing.lg, Spacing.lg),
                    selectableGroup(),
                  ]}
                >
                  <Text style={composeTextStyles.title}>{t`Theme`}</Text>
                  {themeOptions.map((option) => (
                    <Row
                      key={option.value}
                      verticalAlignment="center"
                      modifiers={[
                        fillMaxWidth(),
                        height(56),
                        selectable(
                          option.value === themePreference,
                          () => {
                            selectTheme(option.value);
                          },
                          "radioButton",
                        ),
                      ]}
                    >
                      <RadioButton
                        selected={option.value === themePreference}
                      />
                      <Text modifiers={[padding(Spacing.md, 0, 0, 0)]}>
                        {option.label}
                      </Text>
                    </Row>
                  ))}
                </Column>
              </ModalBottomSheet>
            ) : null}
          </Column>
        </Host>
      </ThemedView>
    </>
  );
}

const composeTextStyles = {
  title: {
    typography: "titleLarge",
  },
} as const;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
});
