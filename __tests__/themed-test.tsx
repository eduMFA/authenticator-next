import { render } from "@testing-library/react-native";

import { ThemedText, ThemedView } from "@/components/Themed";

describe("themed components", () => {
  test("renders themed text content", () => {
    const { getByText } = render(<ThemedText>Authenticator</ThemedText>);

    expect(getByText("Authenticator")).toBeTruthy();
  });

  test("matches the themed text snapshot", () => {
    const tree = render(
      <ThemedView>
        <ThemedText fontWeight="semiBold">Authenticator</ThemedText>
      </ThemedView>,
    ).toJSON();

    expect(tree).toMatchSnapshot();
  });
});
