const NativeEnvironment = require("jest-expo/src/preset/nativeEnvironment");

// Preserve the host's real HTTP client before Expo installs native fetch globals.
module.exports = class HttpEnvironment extends NativeEnvironment {
  async setup() {
    await super.setup();
    this.global.httpFetch = fetch;
  }
};
