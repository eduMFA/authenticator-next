import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type SettingsState = {};

export const useSettingsStore = () =>
  create(
    persist<SettingsState>((set, get) => ({}), {
      name: "settings-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }),
  );
