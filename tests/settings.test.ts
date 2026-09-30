import { useSettingsStore } from "@/stores/settings";
import { setSentryTrackingEnabled } from "@/utils/sentry";
import { Settings } from "react-native-pulsar";

jest.mock("@/utils/sentry", () => ({ setSentryTrackingEnabled: jest.fn() }));
jest.mock("react-native-pulsar", () => ({
  Settings: { enableHaptics: jest.fn() },
}));
beforeEach(async () => {
  await useSettingsStore.persist.rehydrate();
  useSettingsStore.setState({
    crashReportsEnabled: false,
    hapticsEnabled: true,
    hasCompletedOnboarding: false,
    hasHydrated: true,
    themePreference: "automatic",
  });
});
test("updates onboarding and theme preferences", () => {
  const store = useSettingsStore.getState();
  store.completeOnboarding();
  expect(useSettingsStore.getState().hasCompletedOnboarding).toBe(true);
  store.resetOnboarding();
  expect(useSettingsStore.getState().hasCompletedOnboarding).toBe(false);
  store.setThemePreference("dark");
  expect(useSettingsStore.getState().themePreference).toBe("dark");
  store.setHasHydrated(false);
  expect(useSettingsStore.getState().hasHydrated).toBe(false);
});
test("applies crash reporting consent and haptic preference", () => {
  const store = useSettingsStore.getState();
  store.setCrashReportsEnabled(true);
  expect(setSentryTrackingEnabled).toHaveBeenLastCalledWith(true);
  expect(useSettingsStore.getState().crashReportsEnabled).toBe(true);
  store.setCrashReportsEnabled(false);
  expect(setSentryTrackingEnabled).toHaveBeenLastCalledWith(false);
  store.setHapticsEnabled(false);
  expect(Settings.enableHaptics).toHaveBeenLastCalledWith(false);
  expect(useSettingsStore.getState().hapticsEnabled).toBe(false);
});
test("rehydration restores preferences and initializes integrations", async () => {
  useSettingsStore.getState().setCrashReportsEnabled(true);
  useSettingsStore.getState().setHapticsEnabled(false);
  const storage = useSettingsStore.persist.getOptions().storage;
  const snapshot = await storage?.getItem("settings-storage");
  expect(snapshot?.state).toEqual({
    crashReportsEnabled: true,
    hapticsEnabled: false,
    hasCompletedOnboarding: false,
    themePreference: "automatic",
  });
  await useSettingsStore.persist.rehydrate();
  expect(useSettingsStore.getState().hasHydrated).toBe(true);
  expect(setSentryTrackingEnabled).toHaveBeenLastCalledWith(true);
  expect(Settings.enableHaptics).toHaveBeenLastCalledWith(false);
});
