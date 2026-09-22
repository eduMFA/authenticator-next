import type { SFSymbol } from "expo-symbols";
import type { ImageSourcePropType } from "react-native";

export type DevMenuAction = {
  androidIcon: ImageSourcePropType;
  destructive?: boolean;
  disabled?: boolean;
  iosIcon: SFSymbol;
  key: string;
  label: string;
  onPress: () => void;
};

export type DevMenuSection = {
  actions: DevMenuAction[];
  androidIcon: ImageSourcePropType;
  iosIcon: SFSymbol;
  key: string;
  title: string;
};
