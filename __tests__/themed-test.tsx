import { render } from "@testing-library/react-native";

jest.mock("@/constants/theme", () => ({
  Typography: {
    fontSize16: 16,
    fontFamily: "Inter",
    fontFamilyItalic: "Inter-Italic",
    fontFamilyLight: "Inter-Light",
    fontFamilyLightItalic: "Inter-LightItalic",
    fontFamilySemiBold: "Inter-SemiBold",
    fontFamilySemiBoldItalic: "Inter-SemiBoldItalic",
    fontFamilyBold: "Inter-Bold",
    fontFamilyBoldItalic: "Inter-BoldItalic",
  },
}));
jest.mock("@/hooks/use-theme", () => ({
  useTheme: () => ({ background: "#fff", text: "#111" }),
}));

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

describe("themed components", () => {
  test("renders themed text content", async () => {
    const { getByText } = await render(
      <ThemedText>Authenticator</ThemedText>,
    );

    expect(getByText("Authenticator")).toBeTruthy();
  });

  test("applies theme and typography styles", async () => {
    const { getByText, toJSON } = await render(
      <ThemedView>
        <ThemedText fontWeight="semiBold">Authenticator</ThemedText>
      </ThemedView>,
    );

    expect(getByText("Authenticator")).toHaveStyle({
      color: "#111",
      fontFamily: "Inter-SemiBold",
      fontSize: 16,
    });
    expect(toJSON()).toMatchObject({
      props: {
        style: [{ backgroundColor: "#fff" }, undefined],
      },
    });
  });
});
