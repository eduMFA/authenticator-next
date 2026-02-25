import { i18n } from "@lingui/core";
import { getLocales } from "expo-localization";

import { messages as deMessages } from "@/locales/de/messages";
import { messages as enMessages } from "@/locales/en/messages";

const messagesByLocale = {
  de: deMessages,
  en: enMessages,
} as const;

const defaultLocale = "en";

export function resolveLocale() {
  const locale = getLocales()[0]?.languageCode?.toLowerCase();

  if (locale && locale in messagesByLocale) {
    return locale as keyof typeof messagesByLocale;
  }

  return defaultLocale;
}

export function activateCurrentLocale() {
  const locale = resolveLocale();
  i18n.loadAndActivate({ locale, messages: messagesByLocale[locale] });
}
