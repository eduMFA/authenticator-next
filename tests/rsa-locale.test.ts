import Rsa from "../modules/edumfa-rsa";
import {
  deleteRsaKeyPair,
  generateRsaKeyPair,
  getRsaPublicKey,
  signMessage,
  verifyMessage,
} from "@/utils/rsa";
import { activateCurrentLocale, resolveLocale } from "@/utils/locale";
import { getLocales } from "expo-localization";
import { i18n } from "@lingui/core";

jest.mock("../modules/edumfa-rsa", () => ({
  __esModule: true,
  default: {
    generateKeyPair: jest.fn(),
    getPublicKey: jest.fn(),
    sign: jest.fn(),
    verify: jest.fn(),
    deleteKeyPair: jest.fn(),
  },
}));
jest.mock("expo-localization", () => ({ getLocales: jest.fn() }));

test("forwards RSA key operations and returns native results", async () => {
  jest.mocked(Rsa.generateKeyPair).mockResolvedValue({ publicKey: "key" });
  jest.mocked(Rsa.getPublicKey).mockResolvedValue({ publicKey: "key" });
  jest.mocked(Rsa.deleteKeyPair).mockResolvedValue(true);
  expect(await generateRsaKeyPair("alias", 4096)).toEqual({ publicKey: "key" });
  expect(Rsa.generateKeyPair).toHaveBeenCalledWith("alias", 4096);
  expect(await getRsaPublicKey("alias")).toEqual({ publicKey: "key" });
  expect(Rsa.getPublicKey).toHaveBeenCalledWith("alias");
  expect(await deleteRsaKeyPair("alias")).toBe(true);
  expect(Rsa.deleteKeyPair).toHaveBeenCalledWith("alias");
});
test("forwards signing and verification with default or explicit algorithms", async () => {
  jest.mocked(Rsa.sign).mockResolvedValue("signature");
  jest.mocked(Rsa.verify).mockResolvedValue(true);
  expect(await signMessage("message", "alias")).toBe("signature");
  expect(Rsa.sign).toHaveBeenLastCalledWith("message", "alias", "SHA256");
  await signMessage("message", "alias", "SHA512");
  expect(Rsa.sign).toHaveBeenLastCalledWith("message", "alias", "SHA512");
  expect(await verifyMessage("message", "signature", "key")).toBe(true);
  expect(Rsa.verify).toHaveBeenLastCalledWith(
    "message",
    "signature",
    "key",
    "SHA256",
  );
  await verifyMessage("message", "signature", "key", "SHA1");
  expect(Rsa.verify).toHaveBeenLastCalledWith(
    "message",
    "signature",
    "key",
    "SHA1",
  );
});
test("propagates native errors", async () => {
  jest.mocked(Rsa.sign).mockRejectedValue(new Error("missing key"));
  await expect(signMessage("message", "alias")).rejects.toThrow("missing key");
});
test.each(["de", "DE", "en", "fr", null])(
  "resolves device locale %s",
  (languageCode) => {
    jest
      .mocked(getLocales)
      .mockReturnValue([{ languageCode }] as unknown as ReturnType<
        typeof getLocales
      >);
    expect(resolveLocale()).toBe(
      languageCode?.toLowerCase() === "de" ? "de" : "en",
    );
  },
);
test("falls back when no locale exists and activates bundled translations", () => {
  jest
    .mocked(getLocales)
    .mockReturnValue([] as unknown as ReturnType<typeof getLocales>);
  expect(resolveLocale()).toBe("en");
  const activate = jest.spyOn(i18n, "loadAndActivate");
  activateCurrentLocale();
  expect(activate).toHaveBeenCalledWith({
    locale: "en",
    messages: expect.any(Object),
  });
});
