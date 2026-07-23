import {
  Form,
  Host,
  Section,
  TextField,
  useNativeState,
} from "@expo/ui/swift-ui";
import {
  autocorrectionDisabled,
  submitLabel,
  textContentType,
} from "@expo/ui/swift-ui/modifiers";
import { useLingui } from "@lingui/react/macro";
import { useCallback } from "react";
import { StyleSheet } from "react-native";
import type { EditableTokenFields } from "@/types/token-detail";

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
    <Host style={styles.editHost}>
      <Form>
        <Section title={t`Token`}>
          <TextField
            autoFocus
            text={labelState}
            placeholder={t`Label`}
            onTextChange={(label) => updateFields({ label })}
            modifiers={[
              autocorrectionDisabled(),
              submitLabel("done"),
              textContentType("name"),
            ]}
          />
        </Section>
      </Form>
    </Host>
  );
}

const styles = StyleSheet.create({
  editHost: {
    height: 180,
    width: "100%",
  },
});
