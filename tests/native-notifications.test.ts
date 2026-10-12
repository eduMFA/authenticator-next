import { requireNativeModule } from "expo";
import {
  addNativeNotificationListener,
  submitNativeNotification,
  synchronizeNativeNotifications,
} from "@/utils/native-notifications";
import { PushRequestStatus } from "@/types/push-request";
import { request, token } from "./fixtures";

jest.mock("expo", () => ({ requireNativeModule: jest.fn() }));
jest.mock("@react-native-firebase/messaging", () => ({}));

const native = {
  synchronize: jest.fn(),
  submit: jest.fn(),
  addListener: jest.fn(),
};
beforeEach(() => jest.mocked(requireNativeModule).mockReturnValue(native));

test("copies only enrolled public configuration and reconciles well-formed native results", async () => {
  native.synchronize.mockResolvedValue(
    JSON.stringify([
      null,
      { ...request, id: null },
      { ...request, sentAt: "now" },
      { ...request, status: "unknown" },
      { ...request, signature: null },
      request,
    ]),
  );
  expect(
    await synchronizeNativeNotifications(
      [
        { ...token, serverPublicKey: "key" },
        { ...token, id: "not-enrolled" },
      ],
      [request],
    ),
  ).toEqual([request]);
  expect(JSON.parse(native.synchronize.mock.calls[0][0] as string)).toEqual({
    tokens: [
      { id: token.id, callbackUrl: token.callbackUrl, serverPublicKey: "key" },
    ],
    requests: [request],
  });
  expect(requireNativeModule).toHaveBeenCalledWith("EduMfaNotifications");
});

test.each([
  [PushRequestStatus.Accepted, "ACCEPT"],
  [PushRequestStatus.Declined, "DECLINE"],
])("forwards %s to native submission", async (status, action) => {
  native.submit.mockResolvedValue(true);
  const candidate = { ...request, status };
  expect(await submitNativeNotification(candidate)).toBe(true);
  expect(native.submit).toHaveBeenCalledWith(JSON.stringify(candidate), action);
});

test("removes the native completion listener on cleanup", () => {
  const remove = jest.fn();
  native.addListener.mockReturnValue({ remove });
  const handler = jest.fn();
  const cleanup = addNativeNotificationListener(handler);
  expect(native.addListener).toHaveBeenCalledWith("onActionCompleted", handler);
  cleanup();
  expect(remove).toHaveBeenCalledTimes(1);
});

test("rejects malformed native journal responses", async () => {
  native.synchronize.mockResolvedValue("{}");
  await expect(synchronizeNativeNotifications([], [])).rejects.toThrow(
    "Invalid native notification results",
  );
});
