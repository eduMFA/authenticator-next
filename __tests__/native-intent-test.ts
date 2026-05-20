import { redirectSystemPath } from "@/app/+native-intent";

describe("native intent redirect", () => {
  test("keeps external deep links on the app root", () => {
    expect(redirectSystemPath({ path: "/unknown", initial: true })).toBe("/");
  });
});
