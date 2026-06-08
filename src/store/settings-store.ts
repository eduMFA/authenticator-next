import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type SettingsState = Record<string, never>;

export const useSettingsStore = () =>
  create(
    persist<SettingsState>(() => ({}), {
      name: "settings-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }),
  );
