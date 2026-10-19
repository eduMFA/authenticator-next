const { withAppDelegate } = require("expo/config-plugins");

module.exports = function withFirebaseSceneSupport(config) {
  return withAppDelegate(config, (config) => {
    const delegate = config.modResults;
    if (delegate.language !== "swift") {
      throw new Error("Firebase scene support requires a Swift AppDelegate.");
    }
    if (delegate.contents.includes("FirebaseApp.configure()")) return config;
    const anchor =
      "return super.application(application, didFinishLaunchingWithOptions: launchOptions)";
    if (!delegate.contents.includes(anchor)) {
      throw new Error("Cannot find Firebase initialization point.");
    }
    if (!delegate.contents.includes("import FirebaseCore")) {
      delegate.contents = `import FirebaseCore\n${delegate.contents}`;
    }
    delegate.contents = delegate.contents.replace(
      anchor,
      `FirebaseApp.configure()\n    ${anchor}`,
    );
    return config;
  });
};
