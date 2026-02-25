import { Image } from "expo-image";
import { useState } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import SquircleView from "react-native-fast-squircle";

import { theme } from "@/theme";
import { useThemeColor } from "./Themed";

export function TokenImage({
  imageUrl,
  size,
  style,
  animated,
}: {
  imageUrl?: string | null;
  size?: "small" | "medium" | "large" | "xlarge";
  style?: ViewStyle;
  animated?: boolean;
}) {
  const borderColor = useThemeColor(theme.color.border);
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

  const placeholder = <View style={[imageStyles, styles.fallbackImage]} />;

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
    backgroundColor: theme.color.branding.dark,
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
