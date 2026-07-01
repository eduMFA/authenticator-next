import type { TokenActionKey } from "@/types/token-actions";
import { type ImageSourcePropType } from "react-native";
import { Spacing } from "./theme";

export const TOKEN_ACTION_MENU_ANCHOR_SIZE = 1;
export const TOKEN_ACTION_MENU_ICON_SIZE = 24;
export const TOKEN_ACTIONS_MENU_VERTICAL_OFFSET = Spacing.xs;

export const TOKEN_ACTION_MENU_ICONS = {
  delete: require("@expo/material-symbols/delete.xml"),
  edit: require("@expo/material-symbols/edit.xml"),
  refresh: require("@expo/material-symbols/refresh.xml"),
} satisfies Record<TokenActionKey, ImageSourcePropType>;
