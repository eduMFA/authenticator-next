import { ThemedText } from "@/components/themed-text";
import { ONBOARDING_MAX_FONT_SIZE_MULTIPLIER } from "@/constants/onboarding";
import { Spacing, Typography } from "@/constants/theme";
import { Pressable, StyleSheet, type ColorValue } from "react-native";

type TextButtonProps = {
  color: ColorValue;
  label: string;
  onPress: () => void;
  scale?: number;
};

export function TextButton({
  color,
  label,
  onPress,
  scale = 1,
}: TextButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={styles.textButton}
    >
      <ThemedText
        fontSize={Typography.fontSize14 * scale}
        fontWeight="semiBold"
        maxFontSizeMultiplier={ONBOARDING_MAX_FONT_SIZE_MULTIPLIER}
        style={[
          styles.textButtonLabel,
          {
            color,
            lineHeight: Typography.fontSize14 * scale * 1.25,
          },
        ]}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  textButton: {
    alignItems: "center",
    alignSelf: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: Spacing.sm,
  },
  textButtonLabel: {
    textAlign: "center",
  },
});
