import { Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import CloseSymbol from "@expo/material-symbols/close.xml";
import ConstructionSymbol from "@expo/material-symbols/construction.xml";
import SettingsSymbol from "@expo/material-symbols/settings.xml";
import {
  AnimatedVisibility,
  EnterTransition,
  ExitTransition,
  Host,
  Icon,
  IconButton,
  RNHostView,
  Row,
  Shape,
  Text,
  TextField,
  type TextFieldRef,
  useNativeState,
} from "@expo/ui/jetpack-compose";
import {
  fillMaxWidth,
  height,
  size,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  Keyboard,
  Platform,
  StyleSheet,
  TextInput as ReactNativeTextInput,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const logoSource = require("../../assets/app-icons/edumfa.icon/Assets/logo.svg");

const iconEnterTransition = EnterTransition.fadeIn({ initialAlpha: 0.6 }).plus(
  EnterTransition.slideInHorizontally({ initialOffsetX: 0.2 }),
);
const reverseIconExitTransition = ExitTransition.fadeOut({
  targetAlpha: 0.6,
}).plus(ExitTransition.slideOutHorizontally({ targetOffsetX: 0.2 }));
const searchTextStyle = {
  fontFamily: Typography.fontFamily,
  fontSize: Typography.fontSize16,
  fontWeight: "500",
} as const;

export type AndroidTokenSearchBarHandle = {
  blur: () => void;
};

type AndroidTokenSearchBarProps = {
  onDevMenuPress?: () => void;
  onQueryChange: (query: string) => void;
  onSettingsPress: () => void;
  placeholder: string;
  query: string;
};

export const AndroidTokenSearchBar = forwardRef<
  AndroidTokenSearchBarHandle,
  AndroidTokenSearchBarProps
>(function AndroidTokenSearchBar(
  { onDevMenuPress, onQueryChange, onSettingsPress, placeholder, query },
  forwardedRef,
) {
  const theme = useTheme();
  const nativeQuery = useNativeState(query);
  const inputRef = useRef<TextFieldRef>(null);
  const keyboardDismissTargetRef = useRef<ReactNativeTextInput>(null);
  const isFocusedRef = useRef(false);
  const [isFocused, setIsFocused] = useState(false);
  const focusProgress = useSharedValue(0);

  const dismissInput = useCallback(() => {
    const wasFocused = isFocusedRef.current;

    void inputRef.current?.blur();
    Keyboard.dismiss();

    if (wasFocused) {
      isFocusedRef.current = false;
      setIsFocused(false);

      const usesLegacyAndroidIme =
        typeof Platform.Version === "number" && Platform.Version < 29;

      if (usesLegacyAndroidIme) {
        keyboardDismissTargetRef.current?.focus();
        requestAnimationFrame(() => {
          keyboardDismissTargetRef.current?.blur();
          Keyboard.dismiss();
        });
      }
    }
  }, []);

  useEffect(() => {
    focusProgress.value = withTiming(isFocused ? 1 : 0, { duration: 180 });
  }, [focusProgress, isFocused]);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - focusProgress.value,
    transform: [{ translateX: -4 * focusProgress.value }],
  }));
  const searchAnimatedStyle = useAnimatedStyle(() => ({
    opacity: focusProgress.value,
    transform: [{ translateX: 4 * (1 - focusProgress.value) }],
  }));

  useImperativeHandle(
    forwardedRef,
    () => ({
      blur: dismissInput,
    }),
    [dismissInput],
  );

  useEffect(() => {
    if (nativeQuery.get() !== query) {
      nativeQuery.set(query);
    }
  }, [nativeQuery, query]);

  const handleClose = () => {
    if (query) {
      nativeQuery.set("");
      onQueryChange("");
      void inputRef.current?.focus();
      return;
    }

    dismissInput();
  };

  const handleFocusChanged = (focused: boolean) => {
    isFocusedRef.current = focused;
    setIsFocused(focused);
  };

  const containerColor = theme.backgroundSecondary;

  return (
    <Host style={styles.host}>
      <Row
        horizontalArrangement={{ spacedBy: 4 }}
        verticalAlignment="center"
        modifiers={[fillMaxWidth(), height(56)]}
      >
        <TextField
          ref={inputRef}
          value={nativeQuery}
          singleLine
          shape={Shape.Pill({})}
          colors={{
            cursorColor: theme.branding,
            focusedContainerColor: containerColor,
            unfocusedContainerColor: containerColor,
            focusedIndicatorColor: containerColor,
            unfocusedIndicatorColor: containerColor,
            focusedPlaceholderColor: theme.textSecondary,
            unfocusedPlaceholderColor: theme.textSecondary,
            focusedTextColor: theme.text,
            unfocusedTextColor: theme.text,
          }}
          keyboardOptions={{ imeAction: "search" }}
          textStyle={searchTextStyle}
          keyboardActions={{
            onSearch: () => {
              dismissInput();
            },
          }}
          modifiers={[weight(1), height(56)]}
          onFocusChanged={handleFocusChanged}
          onValueChange={onQueryChange}
        >
          <TextField.LeadingIcon>
            <RNHostView matchContents>
              <View style={styles.leadingIconContainer}>
                <ReactNativeTextInput
                  ref={keyboardDismissTargetRef}
                  accessibilityElementsHidden
                  caretHidden
                  importantForAccessibility="no-hide-descendants"
                  showSoftInputOnFocus={false}
                  style={styles.keyboardDismissTarget}
                />
                <Animated.View
                  pointerEvents="none"
                  style={[styles.leadingIcon, logoAnimatedStyle]}
                >
                  <View style={styles.logoContainer}>
                    <Image
                      accessibilityLabel="eduMFA"
                      contentFit="contain"
                      source={logoSource}
                      style={[styles.logo, { tintColor: theme.text }]}
                    />
                  </View>
                </Animated.View>
                <Animated.View
                  pointerEvents="none"
                  style={[styles.leadingIcon, searchAnimatedStyle]}
                >
                  <SymbolView
                    name={{ ios: "magnifyingglass", android: "search" }}
                    size={24}
                    tintColor={theme.text}
                  />
                </Animated.View>
              </View>
            </RNHostView>
          </TextField.LeadingIcon>
          <TextField.Placeholder>
            <Text style={searchTextStyle}>{placeholder}</Text>
          </TextField.Placeholder>
          <TextField.TrailingIcon>
            <AnimatedVisibility
              visible={isFocused}
              enterTransition={iconEnterTransition}
              exitTransition={reverseIconExitTransition}
            >
              <IconButton onClick={handleClose} modifiers={[size(40, 40)]}>
                <Icon
                  contentDescription={query ? "Clear search" : "Close search"}
                  source={CloseSymbol}
                  tint={theme.textSecondary}
                  size={22}
                />
              </IconButton>
            </AnimatedVisibility>
          </TextField.TrailingIcon>
        </TextField>
        {onDevMenuPress ? (
          <IconButton onClick={onDevMenuPress} modifiers={[size(48, 48)]}>
            <Icon
              contentDescription="Developer tools"
              source={ConstructionSymbol}
              tint={theme.textSecondary}
              size={24}
            />
          </IconButton>
        ) : null}
        <IconButton onClick={onSettingsPress} modifiers={[size(48, 48)]}>
          <Icon
            contentDescription="Settings"
            source={SettingsSymbol}
            tint={theme.textSecondary}
            size={24}
          />
        </IconButton>
      </Row>
    </Host>
  );
});

const styles = StyleSheet.create({
  host: {
    height: 56,
    width: "100%",
  },
  keyboardDismissTarget: {
    height: 0,
    opacity: 0,
    position: "absolute",
    width: 0,
  },
  leadingIcon: {
    alignItems: "center",
    height: 32,
    justifyContent: "center",
    position: "absolute",
    width: 32,
  },
  leadingIconContainer: {
    height: 32,
    width: 32,
  },
  logo: {
    height: 28,
    width: 28,
  },
  logoContainer: {
    alignItems: "center",
    height: 32,
    justifyContent: "center",
    width: 32,
  },
});
