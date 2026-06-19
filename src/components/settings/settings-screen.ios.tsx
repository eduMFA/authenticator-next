import { useTheme } from "@/hooks/use-theme";
import { ThemePreference, useSettingsStore } from "@/stores/settings";
import {
  Button,
  HStack,
  Host,
  Image,
  List,
  Picker,
  Section,
  Spacer,
  Text,
  Toggle,
} from "@expo/ui/swift-ui";
import { buttonStyle, scrollDisabled, tag } from "@expo/ui/swift-ui/modifiers";
import { useLingui } from "@lingui/react/macro";
import * as Linking from "expo-linking";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, type ColorValue } from "react-native";
import type { SFSymbol } from "sf-symbols-typescript";

export function SettingsScreen() {
  const { t } = useLingui();
  const router = useRouter();
  const theme = useTheme();
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const themePreference = useSettingsStore((state) => state.themePreference);
  const setThemePreference = useSettingsStore(
    (state) => state.setThemePreference,
  );

  const handleThemeChange = (selection: string | number | null) => {
    if (isThemePreference(selection)) {
      setThemePreference(selection);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t`Settings` }} />
      <Host style={styles.screen} useViewportSizeMeasurement>
        <List modifiers={[scrollDisabled()]}>
          <Section title={t`General`}>
            <Toggle isOn={hapticsEnabled} onIsOnChange={setHapticsEnabled}>
              <LabelWithIcon
                iconColor={theme.text}
                label={t`Haptics`}
                systemImage="iphone.radiowaves.left.and.right"
              />
            </Toggle>
            <Picker
              label={
                <LabelWithIcon
                  iconColor={theme.text}
                  label={t`Theme`}
                  systemImage="paintpalette"
                />
              }
              onSelectionChange={handleThemeChange}
              selection={themePreference}
            >
              <Text modifiers={[tag("auto")]}>{t`Auto`}</Text>
              <Text modifiers={[tag("light")]}>{t`Light`}</Text>
              <Text modifiers={[tag("dark")]}>{t`Dark`}</Text>
            </Picker>
            <ChevronButton
              chevronColor={theme.textSecondary}
              iconColor={theme.text}
              label={t`Language`}
              onPress={() => {
                Linking.openSettings();
              }}
              systemImage="globe"
            />
          </Section>

          <Section>
            <ChevronButton
              chevronColor={theme.textSecondary}
              iconColor={theme.text}
              label={t`About`}
              onPress={() => {
                router.navigate("/settings/about");
              }}
              systemImage="info.circle"
            />
          </Section>
        </List>
      </Host>
    </>
  );
}

type ChevronButtonProps = {
  chevronColor: ColorValue;
  iconColor: ColorValue;
  label: string;
  onPress: () => void;
  systemImage: SFSymbol;
};

function ChevronButton({
  chevronColor,
  iconColor,
  label,
  onPress,
  systemImage,
}: ChevronButtonProps) {
  return (
    <Button modifiers={[buttonStyle("plain")]} onPress={onPress}>
      <HStack spacing={12}>
        <Image systemName={systemImage} color={iconColor} />
        <Text>{label}</Text>
        <Spacer />
        <Image systemName="chevron.right" color={chevronColor} size={13} />
      </HStack>
    </Button>
  );
}

type LabelWithIconProps = {
  iconColor: ColorValue;
  label: string;
  systemImage: SFSymbol;
};

function LabelWithIcon({ iconColor, label, systemImage }: LabelWithIconProps) {
  return (
    <HStack spacing={12}>
      <Image systemName={systemImage} color={iconColor} />
      <Text>{label}</Text>
    </HStack>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
});

function isThemePreference(
  value: string | number | null,
): value is ThemePreference {
  return value === "auto" || value === "light" || value === "dark";
}
