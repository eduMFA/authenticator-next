import { Host, HStack, Text } from "@expo/ui/swift-ui";
import {
  animation,
  Animation,
  contentTransition,
  fixedSize,
  font,
  foregroundStyle,
  monospacedDigit,
} from "@expo/ui/swift-ui/modifiers";
import { View } from "react-native";

type ProgressTextProps = {
  styles?: any;
  value: string;
  progress: number;
};

export default function ProgressText({
  styles,
  value,
  progress,
}: ProgressTextProps) {
  return (
    <View style={styles}>
      <Host matchContents>
        <HStack>
          <Text
            modifiers={[
              font({ size: 18, weight: "bold" }),
              monospacedDigit(),
              fixedSize({ horizontal: true, vertical: false }),
              contentTransition("numericText"),
              foregroundStyle({ type: "hierarchical", style: "primary" }),
              animation(
                Animation.spring({ response: 0.4, dampingFraction: 0.6 }),
                progress,
              ),
            ]}
          >
            {value}
          </Text>
        </HStack>
      </Host>
    </View>
  );
}
