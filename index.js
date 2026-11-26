import { presentBackgroundPushRequest } from "./src/services/push-delivery";
import { addBackgroundMessageHandler } from "./src/utils/notification";
import { Platform } from "react-native";

if (Platform.OS === "android") {
  addBackgroundMessageHandler(presentBackgroundPushRequest);
}

require("expo-router/entry");
