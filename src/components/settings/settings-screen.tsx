import { ThemedView } from "@/components/themed-view";
import { Stack } from "expo-router";
import { StyleSheet } from "react-native";

export function SettingsScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Settings" }} />
      <ThemedView style={styles.screen} />
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
});
