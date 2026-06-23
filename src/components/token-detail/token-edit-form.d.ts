import type { EditableTokenFields } from "@/types/token-detail";

export declare function TokenEditForm({
  fields,
  onChange,
}: {
  fields: EditableTokenFields;
  onChange: (fields: EditableTokenFields) => void;
}): React.JSX.Element;
