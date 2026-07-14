import AsyncStorage from "@react-native-async-storage/async-storage";
import { setSentryTrackingEnabled } from "@/utils/sentry";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type SettingsState = {
  crashReportsEnabled: boolean;
  hasCompletedOnboarding: boolean;
  hasHydrated: boolean;
};

type SettingsActions = {
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  setCrashReportsEnabled: (enabled: boolean) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
};

type SettingsStore = SettingsState & SettingsActions;

type PersistedSettings = Pick<
  SettingsState,
  "crashReportsEnabled" | "hasCompletedOnboarding"
>;

export const useSettingsStore = create<SettingsStore>()(
  persist<SettingsStore, [], [], PersistedSettings>(
    (set) => ({
      crashReportsEnabled: false,
      hasCompletedOnboarding: false,
      hasHydrated: false,
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
      resetOnboarding: () => set({ hasCompletedOnboarding: false }),
      setCrashReportsEnabled: (enabled) => {
        set({ crashReportsEnabled: enabled });
        setSentryTrackingEnabled(enabled);
      },
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: "settings-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        crashReportsEnabled: state.crashReportsEnabled,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
        // Initialize error reporting only after persisted consent is known.
        setSentryTrackingEnabled(state?.crashReportsEnabled ?? false);
      },
    },
  ),
);
