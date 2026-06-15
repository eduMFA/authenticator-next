jest.mock("react-native-reanimated", () => {
  const ReactNative = require("react-native");

  const createAnimatedComponent = (component: unknown) => component;
  const animated = {
    createAnimatedComponent,
    Text: ReactNative.Text,
    View: ReactNative.View,
  };

  return {
    __esModule: true,
    default: animated,
    Easing: {
      inOut: (value: unknown) => value,
      quad: jest.fn(),
    },
    FadeIn: {},
    FadeOut: {},
    LinearTransition: {},
    createAnimatedComponent,
    interpolateColor: (
      _value: number,
      _inputRange: number[],
      outputRange: string[],
    ) => outputRange[0],
    useAnimatedStyle: (updater: () => unknown) => updater(),
    useSharedValue: (value: unknown) => ({ value }),
    withTiming: (value: unknown) => value,
  };
});

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
