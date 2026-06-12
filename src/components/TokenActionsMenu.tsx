import {
  DropdownMenu,
  DropdownMenuItem,
  Host,
  Icon,
  IconButton,
  Text,
} from "@expo/ui/jetpack-compose";
import { size as composeSize } from "@expo/ui/jetpack-compose/modifiers";
import { useTheme } from "@/hooks/use-theme";
import { useState } from "react";
import { type ImageSourcePropType, StyleSheet, View } from "react-native";
import type { SFSymbol } from "sf-symbols-typescript";

export const TOKEN_ACTION_MENU_WIDTH = 56;
const ACTION_MENU_BUTTON_SIZE = 48;
const ACTION_MENU_ICON_SIZE = 24;

const ACTION_MENU_ICONS = {
  delete: require("@expo/material-symbols/delete.xml"),
  edit: require("@expo/material-symbols/edit.xml"),
  menu: require("@expo/material-symbols/more_vert.xml"),
  refresh: require("@expo/material-symbols/refresh.xml"),
} satisfies Record<string, ImageSourcePropType>;

export type TokenActionKey = Exclude<keyof typeof ACTION_MENU_ICONS, "menu">;

export type TokenAction = {
  disabled?: boolean;
  destructive?: boolean;
  iosIcon: SFSymbol;
  key: TokenActionKey;
  label: string;
  onPress: () => Promise<void> | void;
};

export function TokenActionsMenu({ actions }: { actions: TokenAction[] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const theme = useTheme();
  const close = () => setIsExpanded(false);

  return (
    <View style={styles.container}>
      <Host style={styles.host}>
        <DropdownMenu expanded={isExpanded} onDismissRequest={close}>
          <DropdownMenu.Trigger>
            <IconButton
              colors={{
                contentColor: theme.textSecondary,
              }}
              modifiers={[
                composeSize(ACTION_MENU_BUTTON_SIZE, ACTION_MENU_BUTTON_SIZE),
              ]}
              onClick={() => setIsExpanded(true)}
            >
              <Icon
                source={ACTION_MENU_ICONS.menu}
                size={ACTION_MENU_ICON_SIZE}
                tint={theme.textSecondary}
              />
            </IconButton>
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
                    close();
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    position: "absolute",
    right: 0,
    top: 0,
    width: TOKEN_ACTION_MENU_WIDTH,
    zIndex: 3,
  },
  host: {
    height: ACTION_MENU_BUTTON_SIZE,
    width: ACTION_MENU_BUTTON_SIZE,
  },
});
