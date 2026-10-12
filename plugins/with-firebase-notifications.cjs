const { withAndroidManifest } = require("expo/config-plugins");

// Firebase receives FCM messages; Expo presents the verified local notifications.
module.exports = function withFirebaseNotifications(config) {
  return withAndroidManifest(config, (result) => {
    const manifest = result.modResults.manifest;
    manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";
    const application = manifest.application[0];
    const serviceName =
      "expo.modules.notifications.service.ExpoFirebaseMessagingService";
    application.service = (application.service ?? []).filter(
      (service) => service.$["android:name"] !== serviceName,
    );
    application.service.push({
      $: { "android:name": serviceName, "tools:node": "remove" },
    });
    return result;
  });
};
