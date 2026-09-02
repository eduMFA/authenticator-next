import { setSentryTrackingEnabled } from "@/utils/sentry";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Settings as PulsarSettings } from "react-native-pulsar";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ThemePreference = "automatic" | "dark" | "light";

type SettingsState = {
  crashReportsEnabled: boolean;
  hapticsEnabled: boolean;
  hasCompletedOnboarding: boolean;
  hasHydrated: boolean;
  themePreference: ThemePreference;
};

type SettingsActions = {
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  setCrashReportsEnabled: (enabled: boolean) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
  setThemePreference: (preference: ThemePreference) => void;
};

type SettingsStore = SettingsState & SettingsActions;

type PersistedSettings = Pick<
  SettingsState,
  | "crashReportsEnabled"
  | "hapticsEnabled"
  | "hapticsEnabled"
  | "hasCompletedOnboarding"
  | "themePreference"
>;

export const useSettingsStore = create<SettingsStore>()(
  persist<SettingsStore, [], [], PersistedSettings>(
    (set) => ({
      crashReportsEnabled: false,
      hapticsEnabled: true,
      hasCompletedOnboarding: false,
      hasHydrated: false,
      themePreference: "automatic",
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
      resetOnboarding: () => set({ hasCompletedOnboarding: false }),
      setCrashReportsEnabled: (enabled) => {
        set({ crashReportsEnabled: enabled });
        setSentryTrackingEnabled(enabled);
      },
      setHapticsEnabled: (enabled: boolean) => {
        PulsarSettings.enableHaptics(enabled);
        set({ hapticsEnabled: enabled });
      },
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      setThemePreference: (themePreference) => set({ themePreference }),
    }),
    {
      name: "settings-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        crashReportsEnabled: state.crashReportsEnabled,
        hapticsEnabled: state.hapticsEnabled,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        themePreference: state.themePreference,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
        // Initialize error reporting only after persisted consent is known.
        setSentryTrackingEnabled(state?.crashReportsEnabled ?? false);
        PulsarSettings.enableHaptics(state?.hapticsEnabled ?? true);
      },
    },
  ),
);
