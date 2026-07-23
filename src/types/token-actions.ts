import type { SFSymbol } from "sf-symbols-typescript";

export type TokenActionKey = "delete" | "edit" | "refresh";

export type TokenActionsMenuAnchor = {
  x: number;
  y: number;
};

export type TokenAction = {
  disabled?: boolean;
  destructive?: boolean;
  iosIcon: SFSymbol;
  key: TokenActionKey;
  label: string;
  onPress: () => Promise<void> | void;
};

export type TokenActionsMenuProps = {
  actions: TokenAction[];
  anchor: TokenActionsMenuAnchor;
  expanded: boolean;
  onDismissRequest: () => void;
};
