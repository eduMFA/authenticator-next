import { registerBackgroundNotifications } from "./src/services/background-notifications";

registerBackgroundNotifications();

// Register handlers before Expo Router loads the React application.
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("expo-router/entry");
