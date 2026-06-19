import { ThemedView } from "@/components/themed-view";
import { Stack } from "expo-router";
import { StyleSheet } from "react-native";

export function AboutSettingsScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "About" }} />
      <ThemedView style={styles.screen} />
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
});
