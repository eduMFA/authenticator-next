import {
  Host,
  OutlinedTextField,
  Text,
  useNativeState,
} from "@expo/ui/jetpack-compose";
import { useLingui } from "@lingui/react/macro";
import { useCallback } from "react";
import { StyleSheet } from "react-native";
import { EditableTokenFields } from "./token-detail-utils";

export function TokenEditForm({
  fields,
  onChange,
}: {
  fields: EditableTokenFields;
  onChange: (fields: EditableTokenFields) => void;
}) {
  const { t } = useLingui();
  const labelState = useNativeState(fields.label);

  const updateFields = useCallback(
    (updatedFields: Partial<EditableTokenFields>) => {
      onChange({ ...fields, ...updatedFields });
    },
    [fields, onChange],
  );

  return (
    <Host matchContents={{ vertical: true }} style={styles.host}>
      <OutlinedTextField
        autoFocus
        keyboardOptions={{
          autoCorrectEnabled: false,
          capitalization: "words",
          imeAction: "done",
          keyboardType: "text",
        }}
        onValueChange={(label) => updateFields({ label })}
        singleLine
        value={labelState}
      >
        <OutlinedTextField.Label>
          <Text>{t`Label`}</Text>
        </OutlinedTextField.Label>
      </OutlinedTextField>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {
    minHeight: 64,
    width: "100%",
  },
});
