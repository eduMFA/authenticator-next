import { Presets, Settings } from "react-native-pulsar";

export function configureHaptics() {
  try {
    Settings.enableCache(true);
    Settings.preloadPresets(["bloom", "snap", "feather", "fanfare"]);
  } catch (error) {
    if (__DEV__) {
      console.warn("Pulsar haptic setup is unavailable:", error);
    }
  }
}

export function playHaptic(selectPreset: (presets: typeof Presets) => void) {
  try {
    selectPreset(Presets);
  } catch (error) {
    if (__DEV__) {
      console.warn("Pulsar haptic feedback is unavailable:", error);
    }
  }
}
