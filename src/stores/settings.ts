import AsyncStorage from "@react-native-async-storage/async-storage";
import { Settings } from "react-native-pulsar";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type SettingsState = {
  crashReportsEnabled: boolean;
  hapticsEnabled: boolean;
  hasCompletedOnboarding: boolean;
  hasHydrated: boolean;
};

type SettingsActions = {
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  setCrashReportsEnabled: (enabled: boolean) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
};

type SettingsStore = SettingsState & SettingsActions;

type PersistedSettings = Pick<
  SettingsState,
  "crashReportsEnabled" | "hapticsEnabled" | "hasCompletedOnboarding"
>;

export const useSettingsStore = create<SettingsStore>()(
  persist<SettingsStore, [], [], PersistedSettings>(
    (set) => ({
      crashReportsEnabled: false,
      hapticsEnabled: true,
      hasCompletedOnboarding: false,
      hasHydrated: false,
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
      resetOnboarding: () => set({ hasCompletedOnboarding: false }),
      setCrashReportsEnabled: (enabled) =>
        set({ crashReportsEnabled: enabled }),
      setHapticsEnabled: (enabled: boolean) => {
        Settings.enableHaptics(enabled);
        set({ hapticsEnabled: enabled });
      },
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: "settings-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        crashReportsEnabled: state.crashReportsEnabled,
        hapticsEnabled: state.hapticsEnabled,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
        Settings.enableHaptics(state?.hapticsEnabled ?? true);
      },
    },
  ),
);
