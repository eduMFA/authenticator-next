import { theme } from "@/theme";
import { Color } from "expo-router";
import React from "react";
import {
  ColorValue,
  Platform,
  Pressable,
  PressableProps,
  PressableStateCallbackType,
  TextProps as RNTextProps,
  ViewProps as RNViewProps,
  Text,
  TextStyle,
  useColorScheme,
  View,
} from "react-native";
import Animated from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type SchemeValue<T> = { light: T; dark: T };
type ThemeValue<T> = T | SchemeValue<T>;

type ThemeProps = {
  color?: ThemeValue<ColorValue>;
  platformColor?: {
    ios?: ThemeValue<ColorValue>;
    android?: ThemeValue<ColorValue>;
  };
};

const getDefaultPlatformTextColor = (
  color: ThemeValue<ColorValue>,
): ThemeProps["platformColor"] | undefined => {
  if (color === theme.color.text) {
    return { android: Color.android.dynamic.onBackground };
  }

  if (color === theme.color.textSecondary) {
    return { android: Color.android.dynamic.onSurfaceVariant };
  }

  if (color === theme.color.branding) {
    return { android: Color.android.dynamic.primary };
  }

  return undefined;
};

const getDefaultPlatformBackgroundColor = (
  color: ThemeValue<ColorValue>,
): ThemeProps["platformColor"] | undefined => {
  if (color === theme.color.background) {
    return { android: Color.android.dynamic.background };
  }

  if (color === theme.color.backgroundSecondary) {
    return { android: Color.android.dynamic.surfaceContainer };
  }

  if (color === theme.color.branding) {
    return { android: Color.android.dynamic.primary };
  }

  return undefined;
};

export type TextProps = ThemeProps & {
  marginBottom?: number;
  fontSize?: TextStyle["fontSize"];
  fontWeight?: "light" | "medium" | "semiBold" | "bold";
  italic?: boolean;
  animated?: boolean;
} & RNTextProps;
export type ViewProps = ThemeProps & RNViewProps & { animated?: boolean };

const isSchemeValue = <T,>(value: ThemeValue<T>): value is SchemeValue<T> => {
  return (
    typeof value === "object" &&
    value !== null &&
    "light" in value &&
    "dark" in value
  );
};

const resolveThemeValue = <T,>(
  value: ThemeValue<T>,
  colorScheme: "light" | "dark",
) => {
  return isSchemeValue(value) ? value[colorScheme] : value;
};

export function useThemeColor<T>(
  value: ThemeValue<T>,
  platformColor?: {
    ios?: ThemeValue<T>;
    android?: ThemeValue<T>;
  },
) {
  const colorScheme = (useColorScheme() ?? "light") as "light" | "dark";

  const platformValue = Platform.select({
    ios: platformColor?.ios,
    android: platformColor?.android,
  });

  if (platformValue !== undefined) {
    return resolveThemeValue(platformValue, colorScheme);
  }

  return resolveThemeValue(value, colorScheme);
}

export function ThemedText(props: TextProps) {
  const {
    style,
    marginBottom = 0,
    fontSize = theme.fontSize16,
    fontWeight,
    italic,
    animated,
    color: themeColor,
    platformColor,
    ...otherProps
  } = props;

  const defaultColor = themeColor ?? theme.color.text;
  const color = useThemeColor(
    defaultColor,
    platformColor ?? getDefaultPlatformTextColor(defaultColor),
  );

  const fontFamily = (() => {
    if (fontWeight === "light") {
      return italic ? theme.fontFamilyLightItalic : theme.fontFamilyLight;
    } else if (fontWeight === "semiBold") {
      return italic ? theme.fontFamilySemiBoldItalic : theme.fontFamilySemiBold;
    } else if (fontWeight === "bold") {
      return italic ? theme.fontFamilyBoldItalic : theme.fontFamilyBold;
    } else {
      return italic ? theme.fontFamilyItalic : theme.fontFamily;
    }
  })();

  if (animated) {
    return (
      <Animated.Text
        style={[{ color, marginBottom, fontSize, fontFamily }, style]}
        {...otherProps}
      />
    );
  }

  return (
    <Text
      style={[{ color, marginBottom, fontSize, fontFamily }, style]}
      {...otherProps}
    />
  );
}

export function ThemedView(props: ViewProps) {
  const { style, animated, color, platformColor, ...otherProps } = props;
  const defaultColor = color ?? theme.color.background;
  const backgroundColor = useThemeColor(
    defaultColor,
    platformColor ?? getDefaultPlatformBackgroundColor(defaultColor),
  );

  if (animated) {
    return (
      <Animated.View style={[{ backgroundColor }, style]} {...otherProps} />
    );
  }

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}

export function ThemedPressable(
  props: PressableProps & {
    backgroundColor?: ThemeValue<ColorValue>;
    platformBackgroundColor?: {
      ios?: ThemeValue<ColorValue>;
      android?: ThemeValue<ColorValue>;
    };
    animated?: boolean;
  },
) {
  const {
    style,
    animated,
    backgroundColor: themedBackgroundColor,
    platformBackgroundColor,
    ...otherProps
  } = props;
  const defaultBackgroundColor =
    themedBackgroundColor ?? theme.color.background;
  const backgroundColor = useThemeColor(
    defaultBackgroundColor,
    platformBackgroundColor ??
      getDefaultPlatformBackgroundColor(defaultBackgroundColor),
  );
  const themedStyle =
    typeof style === "function"
      ? (state: PressableStateCallbackType) => [
          { backgroundColor },
          style(state),
        ]
      : [{ backgroundColor }, style];

  if (animated) {
    return <AnimatedPressable style={themedStyle} {...otherProps} />;
  }

  return <Pressable style={themedStyle} {...otherProps} />;
}
