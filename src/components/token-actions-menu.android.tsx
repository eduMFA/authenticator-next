import {
  DropdownMenu,
  DropdownMenuItem,
  Host,
  Icon,
  Spacer,
  Text,
} from "@expo/ui/jetpack-compose";
import { size as composeSize } from "@expo/ui/jetpack-compose/modifiers";
import { useTheme } from "@/hooks/use-theme";
import { type ImageSourcePropType, StyleSheet } from "react-native";
import type { SFSymbol } from "sf-symbols-typescript";

const ACTION_MENU_ANCHOR_SIZE = 1;
const ACTION_MENU_ICON_SIZE = 24;

const ACTION_MENU_ICONS = {
  delete: require("@expo/material-symbols/delete.xml"),
  edit: require("@expo/material-symbols/edit.xml"),
  refresh: require("@expo/material-symbols/refresh.xml"),
} satisfies Record<string, ImageSourcePropType>;

export type TokenActionKey = keyof typeof ACTION_MENU_ICONS;

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

type TokenActionsMenuProps = {
  actions: TokenAction[];
  anchor: TokenActionsMenuAnchor;
  expanded: boolean;
  onDismissRequest: () => void;
};

export function TokenActionsMenu({
  actions,
  anchor,
  expanded,
  onDismissRequest,
}: TokenActionsMenuProps) {
  const theme = useTheme();

  return (
    <Host
      pointerEvents={expanded ? "auto" : "none"}
      style={[styles.host, { left: anchor.x, top: anchor.y }]}
    >
      <DropdownMenu expanded={expanded} onDismissRequest={onDismissRequest}>
        <DropdownMenu.Trigger>
          <Spacer
            modifiers={[
              composeSize(ACTION_MENU_ANCHOR_SIZE, ACTION_MENU_ANCHOR_SIZE),
            ]}
          />
        </DropdownMenu.Trigger>
        <DropdownMenu.Items>
          {actions.map((action) => {
            const iconTint = action.destructive
              ? theme.error
              : theme.textSecondary;

            return (
              <DropdownMenuItem
                key={action.key}
                enabled={!action.disabled}
                elementColors={
                  action.destructive ? { textColor: theme.error } : undefined
                }
                onClick={() => {
                  onDismissRequest();
                  action.onPress();
                }}
              >
                <DropdownMenuItem.Text>
                  <Text>{action.label}</Text>
                </DropdownMenuItem.Text>
                <DropdownMenuItem.LeadingIcon>
                  <Icon
                    source={ACTION_MENU_ICONS[action.key]}
                    size={ACTION_MENU_ICON_SIZE}
                    tint={iconTint}
                  />
                </DropdownMenuItem.LeadingIcon>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenu.Items>
      </DropdownMenu>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {
    height: ACTION_MENU_ANCHOR_SIZE,
    position: "absolute",
    width: ACTION_MENU_ANCHOR_SIZE,
    zIndex: 3,
  },
});
