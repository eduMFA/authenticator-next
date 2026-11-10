import { isTokenPollOnly } from "@/utils/token-delivery";
import { PushTokenRolloutState } from "@/types/token";
import { token } from "./fixtures";

test("only completed tokens on Android without Google Play services are marked poll only", () => {
  expect(
    isTokenPollOnly(
      { ...token, rolloutState: PushTokenRolloutState.Completed },
      "google-play-services-unavailable",
    ),
  ).toBe(true);
  expect(isTokenPollOnly(token, "google-play-services-unavailable")).toBe(
    false,
  );
});
test.each(["supported", "ios-simulator", null] as const)(
  "does not mark capability %s poll only because enrollment used an empty FCM token",
  (capability) => {
    expect(
      isTokenPollOnly(
        {
          ...token,
          rolloutState: PushTokenRolloutState.Completed,
          registeredFcmToken: "",
        },
        capability,
      ),
    ).toBe(false);
  },
);
