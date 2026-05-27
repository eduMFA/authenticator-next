import { ThemedText } from "@/components/Themed";
import { TokenImage } from "@/components/TokenImage";
import { theme } from "@/theme";
import { PushToken } from "@/types";
import { useLingui } from "@lingui/react/macro";
import { StyleSheet, View } from "react-native";
import { TokenEditForm } from "./TokenEditForm";
import { EditableTokenFields } from "./token-detail-utils";

export function TokenEditContent({
  token,
  fields,
  onChange,
}: {
  token: PushToken;
  fields: EditableTokenFields;
  onChange: (fields: EditableTokenFields) => void;
}) {
  const { t } = useLingui();

  return (
    <>
      <View style={styles.editHeader}>
        <TokenImage
          imageUrl={token.imageUrl}
          label={fields.label}
          size="medium"
          style={styles.editImage}
          animated
        />
        <View style={styles.editHeaderText}>
          <ThemedText fontSize={theme.fontSize24} fontWeight="bold">
            {t`Edit token`}
          </ThemedText>
          <ThemedText
            color={theme.color.textSecondary}
            fontSize={theme.fontSize14}
            style={styles.editSubtitle}
          >
            {t`Update the display name for this token.`}
          </ThemedText>
        </View>
      </View>
      <TokenEditForm key={token.id} fields={fields} onChange={onChange} />
    </>
  );
}

const styles = StyleSheet.create({
  editHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.space16,
  },
  editHeaderText: {
    flex: 1,
    gap: theme.space4,
  },
  editImage: {
    marginRight: 0,
  },
  editSubtitle: {
    lineHeight: 20,
  },
});
