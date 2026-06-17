import { EditableTokenFields } from "./token-detail-utils";

export declare function TokenEditForm({
  fields,
  onChange,
}: {
  fields: EditableTokenFields;
  onChange: (fields: EditableTokenFields) => void;
}): React.JSX.Element;
