import { ThemedText } from "@/components/themed-text";
import { Spacing, Typography } from "@/constants/theme";
import { Pressable, StyleSheet, type ColorValue } from "react-native";

type TextButtonProps = {
  color: ColorValue;
  label: string;
  onPress: () => void;
};

export function TextButton({ color, label, onPress }: TextButtonProps) {
  return (
    <Pressable onPress={onPress} style={styles.textButton}>
      <ThemedText
        fontSize={Typography.fontSize14}
        fontWeight="semiBold"
        style={[styles.textButtonLabel, { color }]}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  textButton: {
    alignSelf: "center",
    minHeight: 28,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  textButtonLabel: {
    lineHeight: Typography.fontSize14 * 1.25,
    textAlign: "center",
  },
});
