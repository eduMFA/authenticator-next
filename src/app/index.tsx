import { useTokenStore } from "@/store/tokenStore";
import { PushToken } from "@/types";
import { Link, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ToolbarModule from "../../modules/toolbar/src/ToolbarModule";
import { theme } from "../theme";

export default function Tokens() {
  const tokens = useTokenStore();
  const { width, height } = useWindowDimensions();
  const { bottom, top } = useSafeAreaInsets();

  const params = useLocalSearchParams<{ q?: string }>();

  const searchText = params?.q?.toLowerCase() || "";

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const renderItem = useCallback(({ item }: { item: PushToken }) => {
    return (
      <>
        <Animated.View key={item.id} entering={FadeIn} exiting={FadeOut}>
          <Link
            push
            key={item.id}
            href={{
              pathname: "/tokens/[tokenId]",
              params: { tokenId: item.id },
            }}
            asChild
          >
            <Link.Trigger>
              <Pressable onLongPress={() => {}} style={styles.tokenContainer}>
                <Text
                  style={{ fontSize: theme.fontSize18, fontWeight: "bold" }}
                >
                  {item.label}
                </Text>
              </Pressable>
            </Link.Trigger>
            <Link.Preview style={{ ...styles.preview, width: width }}>
              <View></View>
            </Link.Preview>
          </Link>
        </Animated.View>
      </>
    );
  }, []);

  console.log("Rendering Tokens list with searchText:", ToolbarModule.hello());

  return (
    <Animated.FlatList
      scrollToOverflowEnabled
      contentInsetAdjustmentBehavior="automatic"
      onScrollBeginDrag={dismissKeyboard}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.contentContainer,
        {
          paddingBottom: Platform.select({
            android: 100 + bottom,
            ios: 0,
          }),
        },
        { minHeight: height - (bottom + top + 130) },
      ]}
      renderItem={renderItem}
      data={tokens().tokens}
      keyExtractor={(item) => item.id}
      itemLayoutAnimation={LinearTransition}
    />
  );
}

export const styles = StyleSheet.create({
  contentContainer: {
    paddingHorizontal: theme.space16,
  },
  noResultsContainer: {
    padding: theme.space24,
  },
  preview: {
    height: 420,
  },
  separator: {
    height: 1,
  },
  tokenContainer: {
    paddingVertical: theme.space16,
  },
});
