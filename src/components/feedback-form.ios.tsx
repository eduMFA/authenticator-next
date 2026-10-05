import type { FeedbackFormProps } from "@/components/feedback-form.types";
import { Spacing } from "@/constants/theme";
import { useFeedbackForm } from "@/hooks/use-feedback-form";
import {
  Button,
  Form,
  Host,
  HStack,
  Picker,
  Section,
  Spacer,
  Text,
  TextField,
  Toggle,
  VStack,
} from "@expo/ui/swift-ui";
import {
  buttonStyle,
  controlSize,
  font,
  foregroundStyle,
  frame,
  keyboardType,
  lineLimit,
  listRowBackground,
  listRowInsets,
  pickerStyle,
  scrollDismissesKeyboard,
  tag,
  textContentType,
} from "@expo/ui/swift-ui/modifiers";
import { useLingui } from "@lingui/react/macro";
import { StyleSheet } from "react-native";

const ERROR_MODIFIERS = [foregroundStyle("#FF3B30")];

export function FeedbackForm({
  onClose,
  showCloseButton = false,
}: FeedbackFormProps) {
  const { t } = useLingui();
  const form = useFeedbackForm();

  return (
    <Host style={styles.host} useViewportSizeMeasurement>
      <Form modifiers={[scrollDismissesKeyboard("interactively")]}>
        {form.submitted ? (
          <Section>
            <VStack alignment="leading" spacing={Spacing.md}>
              <Text modifiers={[font({ size: 28, weight: "bold" })]}>
                {t`Thank you for your feedback`}
              </Text>
              <Text>{t`Your feedback was submitted successfully.`}</Text>
              <Button
                label={t`Done`}
                modifiers={[
                  buttonStyle("glassProminent"),
                  controlSize("large"),
                ]}
                onPress={onClose}
              />
            </VStack>
          </Section>
        ) : (
          <>
            <Section
              header={
                showCloseButton ? (
                  <VStack alignment="leading" spacing={Spacing.xs}>
                    <HStack>
                      <Text
                        modifiers={[
                          font({ size: 28, weight: "bold" }),
                          foregroundStyle({
                            type: "hierarchical",
                            style: "primary",
                          }),
                        ]}
                      >
                        {t`Send feedback`}
                      </Text>
                      <Spacer />
                      <Button
                        label={t`Close`}
                        onPress={onClose}
                        systemImage="xmark"
                      />
                    </HStack>
                  </VStack>
                ) : (
                  <Text>{t`Feedback details`}</Text>
                )
              }
            >
              <Picker
                label={t`Feedback type`}
                modifiers={[pickerStyle("segmented")]}
                onSelectionChange={form.setFeedbackType}
                selection={form.feedbackType}
              >
                {form.feedbackTypes.map((option) => (
                  <Text key={option.value} modifiers={[tag(option.value)]}>
                    {option.label}
                  </Text>
                ))}
              </Picker>
              <TextField
                axis="vertical"
                maxLength={2000}
                onTextChange={form.changeMessage}
                placeholder={t`What would you like us to know?`}
                modifiers={[lineLimit(5, { reservesSpace: true })]}
              />
              {form.messageError ? (
                <Text modifiers={ERROR_MODIFIERS}>{form.messageError}</Text>
              ) : null}
              {form.submissionError ? (
                <Text modifiers={ERROR_MODIFIERS}>{form.submissionError}</Text>
              ) : null}
              <Toggle
                isOn={form.includeLogs}
                onIsOnChange={form.setIncludeLogs}
              >
                <Text>{t`Include logs`}</Text>
                <Text>{t`Logs provide more context and help us find the cause of the issue.`}</Text>
              </Toggle>
            </Section>

            <Section
              header={<Text>{t`Contact (optional)`}</Text>}
              footer={
                <Text>
                  {t`Name and email are optional. They allow us to contact you with follow-up questions about your feedback.`}
                </Text>
              }
            >
              <TextField
                onTextChange={form.setName}
                placeholder={t`Name (optional)`}
                modifiers={[textContentType("name")]}
              />
              <TextField
                onFocusChange={(focused) => {
                  if (!focused) form.validateCurrentEmail();
                }}
                onTextChange={form.changeEmail}
                placeholder={t`Email (optional)`}
                modifiers={[
                  keyboardType("email-address"),
                  textContentType("emailAddress"),
                ]}
              />
              {form.emailError ? (
                <Text modifiers={ERROR_MODIFIERS}>{form.emailError}</Text>
              ) : null}
            </Section>
            <VStack
              alignment="leading"
              spacing={Spacing.sm}
              modifiers={[
                listRowBackground("clear"),
                listRowInsets({
                  bottom: Spacing.xl * 2,
                  leading: Spacing.lg,
                  top: Spacing.sm,
                  trailing: Spacing.lg,
                }),
              ]}
            >
              <Text
                markdownEnabled
                modifiers={[
                  font({ textStyle: "footnote" }),
                  foregroundStyle({
                    type: "hierarchical",
                    style: "secondary",
                  }),
                ]}
              >
                {t`By sending feedback, you agree to the processing of your data under our [Privacy policy](https://edumfa.io/app-privacy).`}
              </Text>
              <Button
                modifiers={[
                  buttonStyle("glassProminent"),
                  controlSize("large"),
                ]}
                onPress={form.submit}
              >
                <HStack modifiers={[frame({ maxWidth: 1000 })]}>
                  <Spacer />
                  <Text>{t`Submit feedback`}</Text>
                  <Spacer />
                </HStack>
              </Button>
            </VStack>
          </>
        )}
      </Form>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
  },
});
