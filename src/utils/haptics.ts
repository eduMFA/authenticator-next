import {
  refreshHapticRippleDistances,
  refreshHapticThreshold,
} from "@/constants/haptics";
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

export function playImpactLightHaptic() {
  playHaptic((presets) => presets.System.impactLight());
}

export function playImpactMediumHaptic() {
  playHaptic((presets) => presets.System.impactMedium());
}

export function playImpactSoftHaptic() {
  playHaptic((presets) => presets.System.impactSoft());
}

export function playNotificationErrorHaptic() {
  playHaptic((presets) => presets.System.notificationError());
}

export function playNotificationSuccessHaptic() {
  playHaptic((presets) => presets.System.notificationSuccess());
}

export function playNotificationWarningHaptic() {
  playHaptic((presets) => presets.System.notificationWarning());
}

export function getRefreshHapticRippleIndex(pullDistance: number) {
  "worklet";

  let rippleIndex = -1;

  for (let index = 0; index < refreshHapticRippleDistances.length; index++) {
    if (pullDistance >= refreshHapticRippleDistances[index]) {
      rippleIndex = index;
    }
  }

  return rippleIndex;
}

export function getRefreshHapticPullProgress(pullDistance: number) {
  "worklet";

  return Math.min(pullDistance / refreshHapticThreshold, 1);
}

export function getRefreshHapticRipple(
  rippleIndex: number,
  previousRippleIndex: number,
) {
  "worklet";

  const rippleElementProgress =
    (rippleIndex + 1) / refreshHapticRippleDistances.length;
  const isPullingBack = rippleIndex < previousRippleIndex;

  return {
    amplitude: isPullingBack
      ? 0.16 + rippleElementProgress * 0.14
      : 0.35 + rippleElementProgress * 0.35,
    frequency: isPullingBack
      ? 0.72 - rippleElementProgress * 0.18
      : 0.35 + rippleElementProgress * 0.4,
  };
}
