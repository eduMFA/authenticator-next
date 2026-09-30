import type { FeedbackFormProps } from "@/components/feedback-form.types";
import { SETTINGS_LINKS } from "@/constants/settings";
import { Spacing } from "@/constants/theme";
import { useFeedbackForm } from "@/hooks/use-feedback-form";
import ArrowDropDownSymbol from "@expo/material-symbols/arrow_drop_down.xml";
import CloseSymbol from "@expo/material-symbols/close.xml";
import {
  Button,
  DropdownMenuItem,
  ExposedDropdownMenu,
  ExposedDropdownMenuBox,
  Host,
  Icon,
  IconButton,
  LazyColumn,
  OutlinedTextField,
  Row,
  Spacer,
  Text,
  useNativeState,
} from "@expo/ui/jetpack-compose";
import {
  clickable,
  fillMaxSize,
  fillMaxWidth,
  imePadding,
  menuAnchor,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { useLingui } from "@lingui/react/macro";
import * as Linking from "expo-linking";
import { useState } from "react";
import { StyleSheet } from "react-native";

const FULL_WIDTH = [fillMaxWidth()];
const textStyles = {
  caption: { typography: "bodySmall" },
  headline: { typography: "headlineSmall" },
  privacyLink: { textDecoration: "underline" },
  sectionTitle: { typography: "titleMedium" },
  successBody: { typography: "bodyLarge" },
} as const;

export function FeedbackForm({
  onClose,
  showCloseButton = false,
}: FeedbackFormProps) {
  const { t } = useLingui();
  const form = useFeedbackForm();
  const selectedFeedbackType =
    form.feedbackTypes.find((option) => option.value === form.feedbackType) ??
    form.feedbackTypes[0];
  const feedbackTypeLabel = useNativeState(selectedFeedbackType.label);
  const [isFeedbackTypeMenuExpanded, setIsFeedbackTypeMenuExpanded] =
    useState(false);

  return (
    <Host style={styles.host} useViewportSizeMeasurement>
      <LazyColumn
        contentPadding={{
          bottom: Spacing.xl,
          end: Spacing.lg,
          start: Spacing.lg,
          top: Spacing.lg,
        }}
        horizontalAlignment="start"
        modifiers={[fillMaxSize(), imePadding()]}
        verticalArrangement={{ spacedBy: Spacing.sm }}
      >
        {form.submitted ? (
          <>
            <Text style={textStyles.headline}>
              {t`Thank you for your feedback`}
            </Text>
            <Text style={textStyles.successBody}>
              {t`Your feedback was submitted successfully.`}
            </Text>
            <Button modifiers={FULL_WIDTH} onClick={onClose}>
              <Text>{t`Done`}</Text>
            </Button>
          </>
        ) : (
          <>
            {showCloseButton ? (
              <Row
                horizontalAlignment="center"
                modifiers={FULL_WIDTH}
                verticalAlignment="center"
              >
                <Text style={textStyles.headline}>{t`Send feedback`}</Text>
                <Spacer modifiers={[weight(1)]} />
                <IconButton onClick={onClose}>
                  <Icon
                    contentDescription={t`Close`}
                    size={24}
                    source={CloseSymbol}
                  />
                </IconButton>
              </Row>
            ) : null}
            <Text style={textStyles.sectionTitle}>{t`Feedback details`}</Text>
            <ExposedDropdownMenuBox
              expanded={isFeedbackTypeMenuExpanded}
              modifiers={FULL_WIDTH}
              onExpandedChange={setIsFeedbackTypeMenuExpanded}
            >
              <OutlinedTextField
                modifiers={[fillMaxWidth(), menuAnchor()]}
                readOnly
                singleLine
                value={feedbackTypeLabel}
              >
                <OutlinedTextField.Label>
                  <Text>{t`Feedback type`}</Text>
                </OutlinedTextField.Label>
                <OutlinedTextField.TrailingIcon>
                  <Icon
                    contentDescription={t`Feedback type`}
                    size={24}
                    source={ArrowDropDownSymbol}
                  />
                </OutlinedTextField.TrailingIcon>
              </OutlinedTextField>
              <ExposedDropdownMenu
                expanded={isFeedbackTypeMenuExpanded}
                onDismissRequest={() => setIsFeedbackTypeMenuExpanded(false)}
              >
                {form.feedbackTypes.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => {
                      form.setFeedbackType(option.value);
                      feedbackTypeLabel.set(option.label);
                      setIsFeedbackTypeMenuExpanded(false);
                    }}
                  >
                    <DropdownMenuItem.Text>
                      <Text>{option.label}</Text>
                    </DropdownMenuItem.Text>
                  </DropdownMenuItem>
                ))}
              </ExposedDropdownMenu>
            </ExposedDropdownMenuBox>

            <OutlinedTextField
              isError={Boolean(form.messageError || form.submissionError)}
              maxLength={2000}
              maxLines={4}
              minLines={4}
              modifiers={FULL_WIDTH}
              onValueChange={form.changeMessage}
            >
              <OutlinedTextField.Label>
                <Text>{t`What would you like us to know?`}</Text>
              </OutlinedTextField.Label>
              {form.messageError || form.submissionError ? (
                <OutlinedTextField.SupportingText>
                  <Text>{form.messageError ?? form.submissionError}</Text>
                </OutlinedTextField.SupportingText>
              ) : null}
            </OutlinedTextField>

            <Text style={textStyles.sectionTitle}>{t`Contact (optional)`}</Text>
            <Text style={textStyles.caption}>
              {t`Name and email are optional. They allow us to contact you with follow-up questions about your feedback.`}
            </Text>
            <OutlinedTextField
              keyboardOptions={{ capitalization: "words", imeAction: "next" }}
              modifiers={FULL_WIDTH}
              onValueChange={form.setName}
              singleLine
            >
              <OutlinedTextField.Label>
                <Text>{t`Name (optional)`}</Text>
              </OutlinedTextField.Label>
            </OutlinedTextField>
            <OutlinedTextField
              isError={Boolean(form.emailError)}
              keyboardOptions={{ keyboardType: "email", imeAction: "next" }}
              modifiers={FULL_WIDTH}
              onFocusChanged={(focused) => {
                if (!focused) form.validateCurrentEmail();
              }}
              onValueChange={form.changeEmail}
              singleLine
            >
              <OutlinedTextField.Label>
                <Text>{t`Email (optional)`}</Text>
              </OutlinedTextField.Label>
              {form.emailError ? (
                <OutlinedTextField.SupportingText>
                  <Text>{form.emailError}</Text>
                </OutlinedTextField.SupportingText>
              ) : null}
            </OutlinedTextField>
            <Text
              modifiers={[
                clickable(() => void Linking.openURL(SETTINGS_LINKS.privacy)),
              ]}
              style={textStyles.caption}
            >
              {t`By sending feedback, you agree to the processing of your data under our`}{" "}
              <Text style={textStyles.privacyLink}>{t`Privacy policy`}</Text>.
            </Text>
            <Button modifiers={FULL_WIDTH} onClick={form.submit}>
              <Text>{t`Submit feedback`}</Text>
            </Button>
          </>
        )}
      </LazyColumn>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
  },
});
