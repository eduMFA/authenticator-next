import { i18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { authenticateAsync } from "expo-local-authentication";

export class DeviceAuthenticationError extends Error {
  constructor() {
    super(i18n._(msg`Unlock your device to continue.`));
  }
}

export async function requireDeviceAuthentication(
  promptMessage = i18n._(msg`Authenticate with your device`),
): Promise<void> {
  const { success } = await authenticateAsync({
    promptMessage,
    biometricsSecurityLevel: "strong",
  });
  if (!success) throw new DeviceAuthenticationError();
}
