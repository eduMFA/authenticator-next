import type { MessageDescriptor } from "@lingui/core";

export type EditableTokenFields = {
  label: string;
};

export type RefreshErrorDetails = {
  message: string;
  serverMessage?: string;
};

export type RolloutFailureDetails = {
  title: MessageDescriptor;
  description: MessageDescriptor;
};
