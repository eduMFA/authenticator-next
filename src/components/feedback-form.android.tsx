import type { FeedbackFormProps } from "@/components/feedback-form.types";
import { Spacing } from "@/constants/theme";
import { useFeedbackForm } from "@/hooks/use-feedback-form";
import CloseSymbol from "@expo/material-symbols/close.xml";
import {
  Button,
  Host,
  Icon,
  IconButton,
  LazyColumn,
  OutlinedTextField,
  Row,
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
  Spacer,
  Text,
} from "@expo/ui/jetpack-compose";
import {
  fillMaxSize,
  fillMaxWidth,
  imePadding,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { useLingui } from "@lingui/react/macro";
import { StyleSheet } from "react-native";

const FULL_WIDTH = [fillMaxWidth()];
const textStyles = {
  body: { typography: "bodyMedium" },
  caption: { typography: "bodySmall" },
  headline: { typography: "headlineSmall" },
  label: { typography: "labelLarge" },
  segmentedLabel: { typography: "labelSmall" },
  successBody: { typography: "bodyLarge" },
} as const;

export function FeedbackForm({
  onClose,
  showCloseButton = false,
}: FeedbackFormProps) {
  const { t } = useLingui();
  const form = useFeedbackForm();

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
            <Text style={textStyles.body}>
              {t`Tell us what worked well or what we can improve.`}
            </Text>

            <Text style={textStyles.label}>{t`Feedback type`}</Text>
            <SingleChoiceSegmentedButtonRow modifiers={FULL_WIDTH}>
              {form.feedbackTypes.map((option) => (
                <SegmentedButton
                  key={option.value}
                  modifiers={[weight(1)]}
                  onClick={() => form.setFeedbackType(option.value)}
                  selected={option.value === form.feedbackType}
                >
                  <SegmentedButton.Label>
                    <Text maxLines={1} style={textStyles.segmentedLabel}>
                      {option.label}
                    </Text>
                  </SegmentedButton.Label>
                </SegmentedButton>
              ))}
            </SingleChoiceSegmentedButtonRow>

            <Text style={textStyles.caption}>
              {t`Add your name and email if you would like us to contact you with follow-up questions or updates about your feedback.`}
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
            <Text style={textStyles.caption}>
              {t`Your message and optional contact details will be sent to eduMFA through Sentry.`}
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
