import { SettingsLinks } from "@/constants/settings-links";
import { useTheme } from "@/hooks/use-theme";
import {
  Button,
  Form,
  HStack,
  Host,
  Image,
  Section,
  Spacer,
  Text,
  Toggle,
} from "@expo/ui/swift-ui";
import { buttonStyle } from "@expo/ui/swift-ui/modifiers";
import { useLingui } from "@lingui/react/macro";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { Stack } from "expo-router";
import { useState } from "react";
import { StyleSheet, type ColorValue } from "react-native";
import type { SFSymbol } from "sf-symbols-typescript";

export function AboutSettingsScreen() {
  const { t } = useLingui();
  const theme = useTheme();
  const [crashReportsEnabled, setCrashReportsEnabled] = useState(true);
  const version = Constants.expoConfig?.version ?? "1.0.0";

  return (
    <>
      <Stack.Screen options={{ title: t`About` }} />
      <Host style={styles.screen} useViewportSizeMeasurement>
        <Form>
          <Section title="eduMFA">
            <Text>{t`Version ${version}`}</Text>
          </Section>

          <Section>
            <ChevronButton
              chevronColor={theme.textSecondary}
              iconColor={theme.text}
              label={t`Write a Review`}
              onPress={() => {
                openUrl(SettingsLinks.review!);
              }}
              systemImage="star"
            />
            <ChevronButton
              chevronColor={theme.textSecondary}
              iconColor={theme.text}
              label={t`Privacy Policy`}
              onPress={() => {
                openUrl(SettingsLinks.privacyPolicy);
              }}
              systemImage="hand.raised"
            />
          </Section>

          <Section>
            <ChevronButton
              chevronColor={theme.textSecondary}
              iconColor={theme.text}
              label={t`GitHub`}
              onPress={() => {
                openUrl(SettingsLinks.github);
              }}
              systemImage="chevron.left.forwardslash.chevron.right"
            />
            <ChevronButton
              chevronColor={theme.textSecondary}
              iconColor={theme.text}
              label={t`Website`}
              onPress={() => {
                openUrl(SettingsLinks.website);
              }}
              systemImage="globe"
            />
          </Section>

          <Section>
            <Toggle
              isOn={crashReportsEnabled}
              onIsOnChange={setCrashReportsEnabled}
            >
              <LabelWithIcon
                iconColor={theme.text}
                label={t`Crash Reports`}
                systemImage="exclamationmark.triangle"
              />
            </Toggle>
          </Section>
        </Form>
      </Host>
    </>
  );
}

function openUrl(url: string) {
  Linking.openURL(url);
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
