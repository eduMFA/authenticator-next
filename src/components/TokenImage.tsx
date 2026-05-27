import { Image } from "expo-image";
import { Color } from "expo-router";
import { useState } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import SquircleView from "react-native-fast-squircle";

import { theme } from "@/theme";
import { ThemedText, useThemeColor } from "./Themed";

function getInitials(label?: string | null) {
  const source = label?.trim();

  if (!source) {
    return "?";
  }

  const words = source.split(/\s+/).filter(Boolean);
  const initials =
    words.length === 1
      ? words[0].slice(0, 2)
      : `${words[0][0]}${words[words.length - 1][0]}`;

  return initials.toUpperCase();
}

export function TokenImage({
  imageUrl,
  label,
  size,
  style,
  animated,
}: {
  imageUrl?: string | null;
  label?: string | null;
  size?: "small" | "medium" | "large" | "xlarge";
  style?: ViewStyle;
  animated?: boolean;
}) {
  const borderColor = useThemeColor(theme.color.border, {
    android: Color.android.dynamic.outline,
  });
  const fallbackBackgroundColor = useThemeColor(
    theme.color.backgroundSecondary,
    {
      android: Color.android.dynamic.primaryContainer,
    },
  );
  const [isLoading, setIsLoading] = useState(false);
  const imageSize = (() => {
    switch (size) {
      case "small":
        return styles.imageSizeSmall;
      case "large":
        return styles.imageSizeLarge;
      case "xlarge":
        return styles.imageSizeExtraLarge;
      case "medium":
      default:
        return styles.imageSizeMedium;
    }
  })();
  const imageStyles = [styles.profileImage, imageSize];
  const initialsFontSize = (() => {
    switch (size) {
      case "small":
        return theme.fontSize14;
      case "large":
        return theme.fontSize32;
      case "xlarge":
        return theme.fontSize42;
      case "medium":
      default:
        return theme.fontSize20;
    }
  })();

  const placeholder = (
    <View
      style={[
        imageStyles,
        styles.fallbackImage,
        { backgroundColor: fallbackBackgroundColor },
      ]}
    >
      <ThemedText fontSize={initialsFontSize} fontWeight="bold">
        {getInitials(label)}
      </ThemedText>
    </View>
  );

  return (
    <SquircleView
      style={[imageSize, styles.imageContainer, style, { borderColor }]}
      cornerSmoothing={0.7}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={imageStyles}
          transition={animated && isLoading ? 300 : 0}
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => setIsLoading(false)}
        />
      ) : (
        placeholder
      )}
    </SquircleView>
  );
}

const styles = StyleSheet.create({
  fallbackImage: {
    alignItems: "center",
    justifyContent: "center",
  },
  imageContainer: {
    borderWidth: 1,
    marginRight: theme.space12,
    overflow: "hidden",
  },
  imageSizeExtraLarge: {
    borderRadius: 50,
    height: 200,
    width: 200,
  },
  imageSizeLarge: {
    borderRadius: 20,
    height: 96,
    width: 96,
  },
  imageSizeMedium: {
    borderRadius: 15,
    height: 60,
    width: 60,
  },
  imageSizeSmall: {
    borderRadius: 10,
    height: 42,
    width: 42,
  },
  profileImage: {
    height: 70,
    width: 50,
    ...StyleSheet.absoluteFill,
  },
});
