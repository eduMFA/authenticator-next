type RedirectSystemPathParams = {
  path: string;
  initial: boolean;
};

/**
 * Prevent Expo Router from navigating to unknown routes when the app is
 * opened by external deep links (token links are handled manually in _layout).
 */
export function redirectSystemPath(_params: RedirectSystemPathParams) {
  return "/";
}
