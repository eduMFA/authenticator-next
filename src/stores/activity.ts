import type { Activity } from "@/types/activity";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type NewActivity = Omit<Activity, "id"> & { id?: string };

type ActivityState = {
  activities: Activity[];
  addActivity: (activity: NewActivity) => void;
  clearTokenActivities: (tokenId: string) => void;
};

const MAX_ACTIVITIES = 500;

const createActivityId = () =>
  `activity-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const useActivityStore = create(
  persist<ActivityState>(
    (set) => ({
      activities: [],

      addActivity: (activity) =>
        set((state) => {
          const entry = { ...activity, id: activity.id ?? createActivityId() };

          if (state.activities.some((item) => item.id === entry.id)) {
            return state;
          }

          return {
            activities: [entry, ...state.activities].slice(0, MAX_ACTIVITIES),
          };
        }),

      clearTokenActivities: (tokenId) =>
        set((state) => ({
          activities: state.activities.filter(
            (activity) => activity.tokenId !== tokenId,
          ),
        })),
    }),
    {
      name: "activity-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
