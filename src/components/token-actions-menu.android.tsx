import {
  DropdownMenu,
  DropdownMenuItem,
  Host,
  Icon,
  Spacer,
  Text,
} from "@expo/ui/jetpack-compose";
import { size as composeSize } from "@expo/ui/jetpack-compose/modifiers";
import {
  TOKEN_ACTION_MENU_ANCHOR_SIZE,
  TOKEN_ACTION_MENU_ICON_SIZE,
  TOKEN_ACTION_MENU_ICONS,
} from "@/constants/token-actions";
import { useTheme } from "@/hooks/use-theme";
import type { TokenActionsMenuProps } from "@/types/token-actions";
import { StyleSheet } from "react-native";

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
              composeSize(
                TOKEN_ACTION_MENU_ANCHOR_SIZE,
                TOKEN_ACTION_MENU_ANCHOR_SIZE,
              ),
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
                    source={TOKEN_ACTION_MENU_ICONS[action.key]}
                    size={TOKEN_ACTION_MENU_ICON_SIZE}
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
    height: TOKEN_ACTION_MENU_ANCHOR_SIZE,
    position: "absolute",
    width: TOKEN_ACTION_MENU_ANCHOR_SIZE,
    zIndex: 3,
  },
});
