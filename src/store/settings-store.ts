import AsyncStorage from "@react-native-async-storage/async-storage";
import { Settings } from "react-native-pulsar";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type SettingsState = {
  hapticsEnabled: boolean;
  setHapticsEnabled: (enabled: boolean) => void;
};

export const useSettingsStore = create(
  persist<SettingsState>(
    (set) => ({
      hapticsEnabled: true,
      setHapticsEnabled: (enabled: boolean) => {
        Settings.enableHaptics(enabled);
        set({ hapticsEnabled: enabled });
      },
    }),
    {
      name: "settings-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) =>
        ({ hapticsEnabled: state.hapticsEnabled }) as SettingsState,
      onRehydrateStorage: () => {
        return (state) => {
          Settings.enableHaptics(state?.hapticsEnabled ?? true);
        };
      },
    },
  ),
);
