import { Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { DevMenuAction, DevMenuSection } from "@/types/dev-menu";
import {
  Column,
  Host,
  Icon,
  ListItem,
  ModalBottomSheet,
  Text,
} from "@expo/ui/jetpack-compose";
import {
  clickable,
  fillMaxWidth,
  padding,
} from "@expo/ui/jetpack-compose/modifiers";
import { Fragment } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";

type AndroidDevMenuSheetProps = {
  onDismissRequest: () => void;
  sections: DevMenuSection[];
  visible: boolean;
};

export function AndroidDevMenuSheet({
  onDismissRequest,
  sections,
  visible,
}: AndroidDevMenuSheetProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();

  if (!visible) {
    return null;
  }

  const runAction = (action: DevMenuAction) => {
    if (action.disabled) {
      return;
    }

    onDismissRequest();
    requestAnimationFrame(action.onPress);
  };

  return (
    <Host pointerEvents="none" style={[styles.host, { width }]}>
      <ModalBottomSheet
        containerColor={theme.background}
        contentColor={theme.text}
        onDismissRequest={onDismissRequest}
        skipPartiallyExpanded
      >
        <Column modifiers={[fillMaxWidth(), padding(0, 0, 0, 24)]}>
          <Text
            color={theme.text as string}
            modifiers={[padding(24, 8, 24, 12)]}
            style={styles.title}
          >
            Developer tools
          </Text>
          {sections.map((section) => (
            <Fragment key={section.key}>
              <Text
                color={theme.textSecondary as string}
                modifiers={[padding(24, 12, 24, 4)]}
                style={styles.sectionTitle}
              >
                {section.title}
              </Text>
              {section.actions.map((action) => {
                const actionColor = action.destructive
                  ? theme.error
                  : action.disabled
                    ? theme.border
                    : theme.text;
                const modifiers = action.disabled
                  ? [fillMaxWidth()]
                  : [fillMaxWidth(), clickable(() => runAction(action))];

                return (
                  <ListItem
                    key={action.key}
                    colors={{
                      containerColor: theme.background,
                      contentColor: actionColor,
                      leadingContentColor: actionColor,
                    }}
                    modifiers={modifiers}
                  >
                    <ListItem.HeadlineContent>
                      <Text
                        color={actionColor as string}
                        style={styles.actionLabel}
                      >
                        {action.label}
                      </Text>
                    </ListItem.HeadlineContent>
                    <ListItem.LeadingContent>
                      <Icon
                        contentDescription={action.label}
                        size={22}
                        source={action.androidIcon}
                        tint={actionColor}
                      />
                    </ListItem.LeadingContent>
                  </ListItem>
                );
              })}
            </Fragment>
          ))}
        </Column>
      </ModalBottomSheet>
    </Host>
  );
}

const styles = StyleSheet.create({
  actionLabel: {
    fontFamily: Typography.fontFamily,
    fontSize: Typography.fontSize16,
    fontWeight: "500",
  },
  host: {
    position: "absolute",
  },
  sectionTitle: {
    fontFamily: Typography.fontFamilySemiBold,
    fontSize: Typography.fontSize12,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  title: {
    fontFamily: Typography.fontFamilyBold,
    fontSize: Typography.fontSize24,
    fontWeight: "700",
  },
});
