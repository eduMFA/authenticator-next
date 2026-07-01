import type { TokenActionKey } from "@/types/token-actions";
import DeleteSymbol from "@expo/material-symbols/delete.xml";
import EditSymbol from "@expo/material-symbols/edit.xml";
import RefreshSymbol from "@expo/material-symbols/refresh.xml";
import { type ImageSourcePropType } from "react-native";
import { Spacing } from "./theme";

export const TOKEN_ACTION_MENU_ANCHOR_SIZE = 1;
export const TOKEN_ACTION_MENU_ICON_SIZE = 24;
export const TOKEN_ACTIONS_MENU_VERTICAL_OFFSET = Spacing.xs;

export const TOKEN_ACTION_MENU_ICONS = {
  delete: DeleteSymbol,
  edit: EditSymbol,
  refresh: RefreshSymbol,
} satisfies Record<TokenActionKey, ImageSourcePropType>;
