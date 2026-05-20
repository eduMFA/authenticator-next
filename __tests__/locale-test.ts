jest.mock("expo-localization", () => ({
  __esModule: true,
  getLocales: jest.fn(),
}));

jest.mock("@lingui/core", () => ({
  __esModule: true,
  i18n: {
    loadAndActivate: jest.fn(),
  },
}));

import { i18n } from "@lingui/core";
import { getLocales } from "expo-localization";

import { activateCurrentLocale, resolveLocale } from "@/utils/locale";

const mockGetLocales = getLocales as jest.Mock;
const mockLoadAndActivate = i18n.loadAndActivate as jest.Mock;

describe("locale utilities", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("uses supported device locales", () => {
    mockGetLocales.mockReturnValue([{ languageCode: "DE" }]);

    expect(resolveLocale()).toBe("de");
  });

  test("falls back to English for unsupported or missing locales", () => {
    mockGetLocales.mockReturnValue([{ languageCode: "jp" }]);
    expect(resolveLocale()).toBe("en");

    mockGetLocales.mockReturnValue([]);
    expect(resolveLocale()).toBe("en");
  });

  test("activates the resolved locale catalog", () => {
    mockGetLocales.mockReturnValue([{ languageCode: "de" }]);

    activateCurrentLocale();

    expect(mockLoadAndActivate).toHaveBeenCalledWith({
      locale: "de",
      messages: expect.any(Object),
    });
  });
});
