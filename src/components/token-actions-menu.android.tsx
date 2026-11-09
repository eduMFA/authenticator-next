import {
  Box,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuPopup,
  Host,
  Icon,
  Text,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import { size as composeSize } from "@expo/ui/jetpack-compose/modifiers";
import {
  TOKEN_ACTION_MENU_ANCHOR_SIZE,
  TOKEN_ACTION_MENU_ICON_SIZE,
  TOKEN_ACTION_MENU_ICONS,
} from "@/constants/token-actions";
import type { TokenActionsMenuProps } from "@/types/token-actions";
import { StyleSheet, useColorScheme } from "react-native";

export function TokenActionsMenu({
  actions,
  anchor,
  expanded,
  onDismissRequest,
}: TokenActionsMenuProps) {
  const colorScheme = useColorScheme() === "dark" ? "dark" : "light";
  const { error, surfaceContainerHigh } = useMaterialColors({ colorScheme });

  return (
    <Host
      colorScheme={colorScheme}
      pointerEvents={expanded ? "auto" : "none"}
      style={[styles.host, { left: anchor.x, top: anchor.y }]}
    >
      <Box
        modifiers={[
          composeSize(
            TOKEN_ACTION_MENU_ANCHOR_SIZE,
            TOKEN_ACTION_MENU_ANCHOR_SIZE,
          ),
        ]}
      >
        <DropdownMenuPopup
          expanded={expanded}
          onDismissRequest={onDismissRequest}
        >
          <DropdownMenuGroup containerColor={surfaceContainerHigh}>
            {actions.map((action, index) => (
              <DropdownMenuItem
                key={action.key}
                enabled={!action.disabled}
                shape={{ index, count: actions.length }}
                elementColors={
                  action.destructive
                    ? { textColor: error, leadingIconColor: error }
                    : undefined
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
                    source={TOKEN_ACTION_MENU_ICONS[action.key]}
                    size={TOKEN_ACTION_MENU_ICON_SIZE}
                  />
                </DropdownMenuItem.LeadingIcon>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuPopup>
      </Box>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {
    height: TOKEN_ACTION_MENU_ANCHOR_SIZE,
    position: "absolute",
    width: TOKEN_ACTION_MENU_ANCHOR_SIZE,
    zIndex: 3,
  },
});
