import { renderRouter, screen } from "expo-router/testing-library";
import { Text } from "react-native";

const IndexRoute = () => <Text>Token list</Text>;
const TokenRoute = () => <Text>Token detail</Text>;

describe("expo router", () => {
  test("renders an in-memory dynamic token route", () => {
    const router = renderRouter(
      {
        index: IndexRoute,
        "token/[tokenId]": TokenRoute,
      },
      {
        initialUrl: "/token/PUSH0001?source=push",
      },
    );

    expect(screen.getByText("Token detail")).toBeTruthy();
    expect(router.getPathname()).toBe("/token/PUSH0001");
    expect(router.getSearchParams()).toEqual({
      source: "push",
      tokenId: "PUSH0001",
    });
  });
});
