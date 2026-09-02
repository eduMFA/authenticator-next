import { submitUserFeedback, type UserFeedbackType } from "@/utils/sentry";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function useFeedbackForm() {
  const { t } = useLingui();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<UserFeedbackType>("general");
  const [message, setMessage] = useState("");
  const [messageError, setMessageError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const feedbackTypes: readonly {
    label: string;
    value: UserFeedbackType;
  }[] = [
    { label: t`Bug report`, value: "bug_report" },
    { label: t`General`, value: "general" },
    { label: t`Feature request`, value: "feature_request" },
  ];

  const validateEmail = (value: string): string | null => {
    const trimmedEmail = value.trim();
    return trimmedEmail && !EMAIL_PATTERN.test(trimmedEmail)
      ? t`Enter a valid email address.`
      : null;
  };

  const changeEmail = (value: string) => {
    setEmail(value);
    if (emailError) setEmailError(null);
  };

  const changeMessage = (value: string) => {
    setMessage(value);
    if (messageError) setMessageError(null);
  };

  const validateCurrentEmail = () => setEmailError(validateEmail(email));

  const submit = () => {
    const trimmedMessage = message.trim();
    const nextEmailError = validateEmail(email);
    const nextMessageError = trimmedMessage
      ? null
      : t`Please describe your feedback.`;

    setEmailError(nextEmailError);
    setMessageError(nextMessageError);
    setSubmissionError(null);

    if (nextEmailError || nextMessageError) return;

    try {
      submitUserFeedback(
        {
          email: email.trim() || undefined,
          message: trimmedMessage,
          name: name.trim() || undefined,
        },
        feedbackType,
      );
      setSubmitted(true);
    } catch (error) {
      if (__DEV__) console.warn("Failed to submit feedback:", error);
      setSubmissionError(t`Feedback could not be sent. Please try again.`);
    }
  };

  return {
    changeEmail,
    changeMessage,
    emailError,
    feedbackType,
    feedbackTypes,
    messageError,
    setFeedbackType,
    setName,
    submissionError,
    submit,
    submitted,
    validateCurrentEmail,
  };
}
