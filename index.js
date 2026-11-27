import { registerBackgroundNotifications } from "./src/services/background-notifications";
import { Platform } from "react-native";

if (Platform.OS === "android") {
  registerBackgroundNotifications();
}

require("expo-router/entry");
