import { Presets, Settings } from "react-native-pulsar";
import { useSettingsStore } from "@/stores/settings";
import {
  configureHaptics,
  getRefreshHapticPullProgress,
  getRefreshHapticRipple,
  getRefreshHapticRippleIndex,
  playHaptic,
  playImpactLightHaptic,
  playImpactMediumHaptic,
  playImpactSoftHaptic,
  playNotificationErrorHaptic,
  playNotificationSuccessHaptic,
  playNotificationWarningHaptic,
} from "@/utils/haptics";
import {
  refreshHapticRippleDistances,
  refreshHapticThreshold,
} from "@/constants/haptics";

jest.mock("@/stores/settings", () => ({
  useSettingsStore: { getState: jest.fn() },
}));
jest.mock("react-native-pulsar", () => ({
  Settings: { enableCache: jest.fn(), preloadPresets: jest.fn() },
  Presets: {
    System: {
      impactLight: jest.fn(),
      impactMedium: jest.fn(),
      impactSoft: jest.fn(),
      notificationError: jest.fn(),
      notificationSuccess: jest.fn(),
      notificationWarning: jest.fn(),
    },
  },
}));
beforeEach(() => {
  jest
    .mocked(useSettingsStore.getState)
    .mockReturnValue({ hapticsEnabled: true } as ReturnType<
      typeof useSettingsStore.getState
    >);
});

test("preloads haptics and tolerates native failure", () => {
  configureHaptics();
  expect(Settings.enableCache).toHaveBeenCalledWith(true);
  expect(Settings.preloadPresets).toHaveBeenCalledWith([
    "bloom",
    "snap",
    "feather",
    "fanfare",
  ]);
  jest.mocked(Settings.enableCache).mockImplementationOnce(() => {
    throw new Error("unsupported");
  });
  expect(configureHaptics).not.toThrow();
});
test.each([
  [playImpactLightHaptic, "impactLight"],
  [playImpactMediumHaptic, "impactMedium"],
  [playImpactSoftHaptic, "impactSoft"],
  [playNotificationErrorHaptic, "notificationError"],
  [playNotificationSuccessHaptic, "notificationSuccess"],
  [playNotificationWarningHaptic, "notificationWarning"],
] as const)("plays preset %s", (play, preset) => {
  play();
  expect(Presets.System[preset]).toHaveBeenCalledTimes(1);
});
test("respects disabled haptics and tolerates playback failure", () => {
  jest
    .mocked(useSettingsStore.getState)
    .mockReturnValue({ hapticsEnabled: false } as ReturnType<
      typeof useSettingsStore.getState
    >);
  const select = jest.fn();
  playHaptic(select);
  expect(select).not.toHaveBeenCalled();
  jest
    .mocked(useSettingsStore.getState)
    .mockReturnValue({ hapticsEnabled: true } as ReturnType<
      typeof useSettingsStore.getState
    >);
  expect(() =>
    playHaptic(() => {
      throw new Error("unsupported");
    }),
  ).not.toThrow();
});
test("maps pull distances to ripple boundaries and clamps progress", () => {
  expect(getRefreshHapticRippleIndex(0)).toBe(-1);
  refreshHapticRippleDistances.forEach((distance, index) => {
    expect(getRefreshHapticRippleIndex(distance)).toBe(index);
    expect(getRefreshHapticRippleIndex(distance - 0.01)).toBe(index - 1);
  });
  expect(getRefreshHapticPullProgress(0)).toBe(0);
  expect(getRefreshHapticPullProgress(refreshHapticThreshold / 2)).toBe(0.5);
  expect(getRefreshHapticPullProgress(refreshHapticThreshold * 2)).toBe(1);
  expect(getRefreshHapticRipple(0, -1).amplitude).toBeGreaterThan(
    getRefreshHapticRipple(0, 1).amplitude,
  );
  expect(getRefreshHapticRipple(0, -1).frequency).toBeLessThan(
    getRefreshHapticRipple(0, 1).frequency,
  );
});
