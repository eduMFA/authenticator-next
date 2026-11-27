const {
  withEntitlementsPlist,
  withInfoPlist,
  withXcodeProject,
} = require("expo/config-plugins");
const fs = require("node:fs/promises");
const path = require("node:path");
const plist = require("@expo/plist").default;

const targetName = "EduMfaNotificationService";
const tokenImageSource =
  "modules/edumfa-notifications/extension/NotificationTokenImage.swift";
const sources = [
  [tokenImageSource, "NotificationTokenImage.swift"],
  [
    "modules/edumfa-notifications/extension/NotificationService.swift",
    "NotificationService.swift",
  ],
  [
    "modules/edumfa-notifications/ios/EduMfaNotificationJournal.swift",
    "EduMfaNotificationJournal.swift",
  ],
  ["modules/edumfa-rsa/ios/EduMfaRsaCrypto.swift", "EduMfaRsaCrypto.swift"],
];

const previewTarget = "EduMfaNotificationPreview";
const targets = [
  {
    name: targetName,
    suffix: "NotificationService",
    sources,
    extension: {
      NSExtensionPointIdentifier: "com.apple.usernotifications.service",
      NSExtensionPrincipalClass: "$(PRODUCT_MODULE_NAME).NotificationService",
    },
  },
  {
    name: previewTarget,
    suffix: "NotificationPreview",
    sources: [
      [tokenImageSource, "PreviewTokenImage.swift"],
      [
        "modules/edumfa-notifications/preview/NotificationViewController.swift",
        "NotificationViewController.swift",
      ],
      [
        "modules/edumfa-notifications/preview/NotificationPreview.swift",
        "NotificationPreview.swift",
      ],
      [
        "modules/edumfa-notifications/ios/EduMfaNotificationJournal.swift",
        "PreviewJournal.swift",
      ],
      ["modules/edumfa-rsa/ios/EduMfaRsaCrypto.swift", "PreviewCrypto.swift"],
    ],
    resources: ["NotificationPreview.xcstrings"],
    extension: {
      NSExtensionPointIdentifier:
        "com.apple.usernotifications.content-extension",
      NSExtensionPrincipalClass:
        "$(PRODUCT_MODULE_NAME).NotificationViewController",
      NSExtensionAttributes: {
        UNNotificationExtensionCategory: "PUSH_AUTHENTICATION",
        UNNotificationExtensionInitialContentSizeRatio: 0.6,
        UNNotificationExtensionDefaultContentHidden: true,
      },
    },
  },
];

async function configureProject(project, config, projectRoot, iosRoot) {
  for (const target of targets) {
    await configureTarget(project, config, projectRoot, iosRoot, target);
  }
}

async function configureTarget(project, config, projectRoot, iosRoot, spec) {
  const targetName = spec.name;
  const sources = spec.sources;
  const bundle = config.ios.bundleIdentifier;
  const group = `group.${bundle}.notifications`;
  const folder = path.join(iosRoot, targetName);
  await fs.mkdir(folder, { recursive: true });
  for (const [source, destination] of sources) {
    await fs.copyFile(
      path.join(projectRoot, source),
      path.join(folder, destination),
    );
  }
  await fs.writeFile(
    path.join(folder, "Info.plist"),
    plist.build({
      CFBundleDisplayName:
        spec.suffix === "NotificationService"
          ? "eduMFA notification service"
          : "eduMFA notification preview",
      CFBundleExecutable: "$(EXECUTABLE_NAME)",
      CFBundleIdentifier: "$(PRODUCT_BUNDLE_IDENTIFIER)",
      CFBundleInfoDictionaryVersion: "6.0",
      CFBundleDevelopmentRegion: "en",
      CFBundleName: "$(PRODUCT_NAME)",
      CFBundlePackageType: "XPC!",
      CFBundleShortVersionString: "$(MARKETING_VERSION)",
      CFBundleVersion: "$(CURRENT_PROJECT_VERSION)",
      EduMfaNotificationAppGroup: group,
      NSExtension: spec.extension,
    }),
  );
  await fs.writeFile(
    path.join(folder, `${targetName}.entitlements`),
    plist.build({
      "com.apple.security.application-groups": [group],
    }),
  );

  let target = Object.entries(project.pbxNativeTargetSection()).find(
    ([key, value]) =>
      !key.endsWith("_comment") &&
      value.name.replaceAll('"', "") === targetName,
  );
  // A single-target Expo project may not have dependency sections yet. xcode's
  // addTarget silently skips the host dependency unless both sections exist.
  project.hash.project.objects.PBXContainerItemProxy ??= {};
  project.hash.project.objects.PBXTargetDependency ??= {};
  if (!target) {
    const added = project.addTarget(
      targetName,
      "app_extension",
      targetName,
      `${bundle}.${spec.suffix}`,
    );
    target = [added.uuid, added.pbxNativeTarget];
    project.addBuildPhase([], "PBXSourcesBuildPhase", "Sources", added.uuid);
    project.addBuildPhase(
      [],
      "PBXFrameworksBuildPhase",
      "Frameworks",
      added.uuid,
    );
    if (spec.resources?.length) {
      project.addBuildPhase(
        [],
        "PBXResourcesBuildPhase",
        "Resources",
        added.uuid,
      );
    }
  }
  const [targetId, nativeTarget] = target;
  let sourceGroup = project.findPBXGroupKey({ name: targetName });
  if (!sourceGroup) {
    const added = project.addPbxGroup([], targetName, targetName);
    sourceGroup = added.uuid;
    project.addToPbxGroup(
      added.uuid,
      project.getFirstProject().firstProject.mainGroup,
    );
  }
  for (const [, filename] of sources) {
    const members = project.getPBXGroupByKey(sourceGroup).children;
    if (!members.some((member) => member.comment === filename)) {
      project.addSourceFile(filename, { target: targetId }, sourceGroup);
    }
  }
  for (const filename of spec.resources ?? []) {
    await fs.copyFile(
      path.join(projectRoot, "modules/edumfa-notifications/preview", filename),
      path.join(folder, filename),
    );
    if (
      !project
        .getPBXGroupByKey(sourceGroup)
        .children.some((member) => member.comment === filename)
    ) {
      project.addResourceFile(
        filename,
        { target: targetId, lastKnownFileType: "text.json.xcstrings" },
        sourceGroup,
      );
    }
  }
  const configurations = project.pbxXCBuildConfigurationSection();
  const list =
    project.pbxXCConfigurationList()[nativeTarget.buildConfigurationList];
  const host = project.getFirstTarget().firstTarget;
  if (
    !host.dependencies.some(
      (dependency) =>
        project.hash.project.objects.PBXTargetDependency[dependency.value]
          ?.target === targetId,
    )
  ) {
    project.addTargetDependency(project.getFirstTarget().uuid, [targetId]);
  }
  const hostList =
    project.pbxXCConfigurationList()[host.buildConfigurationList];
  for (const reference of list.buildConfigurations) {
    const configuration = configurations[reference.value];
    const hostReference = hostList.buildConfigurations.find(
      (item) => configurations[item.value].name === configuration.name,
    );
    const hostSettings = configurations[hostReference.value].buildSettings;
    Object.assign(configuration.buildSettings, {
      APPLICATION_EXTENSION_API_ONLY: "YES",
      CODE_SIGN_ENTITLEMENTS: `"${targetName}/${targetName}.entitlements"`,
      CODE_SIGN_STYLE: hostSettings.CODE_SIGN_STYLE ?? "Automatic",
      CURRENT_PROJECT_VERSION:
        hostSettings.CURRENT_PROJECT_VERSION ?? config.ios.buildNumber ?? "1",
      MARKETING_VERSION:
        hostSettings.MARKETING_VERSION ?? config.version ?? "1.0.0",
      DEVELOPMENT_TEAM:
        hostSettings.DEVELOPMENT_TEAM ?? config.ios.appleTeamId ?? '""',
      INFOPLIST_FILE: `"${targetName}/Info.plist"`,
      IPHONEOS_DEPLOYMENT_TARGET: "16.4",
      PRODUCT_BUNDLE_IDENTIFIER: `"${bundle}.${spec.suffix}"`,
      SWIFT_VERSION: "5.0",
      TARGETED_DEVICE_FAMILY: '"1,2"',
    });
    if (spec.name === previewTarget) {
      // The extension host discovers its context class dynamically. Importing
      // only the protocol lets the linker strip UserNotificationsUI, causing
      // a launch-time crash before the view controller receives a notification.
      configuration.buildSettings.OTHER_LDFLAGS = [
        '"$(inherited)"',
        '"-Wl,-needed_framework,UserNotificationsUI"',
      ];
    }
  }
  // node-xcode embeds additional extensions in the first Copy Files phase but
  // still creates an empty phase for each target. Keep one populated phase.
  const phases = project.hash.project.objects.PBXCopyFilesBuildPhase;
  for (const [key, phase] of Object.entries(phases)) {
    if (
      !key.endsWith("_comment") &&
      Number(phase.dstSubfolderSpec) === 13 &&
      phase.files.length === 0
    ) {
      host.buildPhases = host.buildPhases.filter(
        (reference) => reference.value !== key,
      );
      delete phases[key];
      delete phases[`${key}_comment`];
    }
  }
  // addTarget embeds the .appex and adds the host dependency. Sign the embedded
  // product too, rather than copying it without the required signing attribute.
  for (const [key, file] of Object.entries(project.pbxBuildFileSection())) {
    if (
      !key.endsWith("_comment") &&
      file.fileRef === nativeTarget.productReference
    ) {
      file.settings = { ATTRIBUTES: ["CodeSignOnCopy", "RemoveHeadersOnCopy"] };
    }
  }
}

module.exports = function withNotificationService(config) {
  const bundle = config.ios?.bundleIdentifier;
  if (!bundle)
    throw new Error("Notification service requires an iOS bundle identifier");
  const group = `group.${bundle}.notifications`;
  config = withEntitlementsPlist(config, (result) => {
    result.modResults["com.apple.security.application-groups"] = [
      ...new Set([
        ...(result.modResults["com.apple.security.application-groups"] ?? []),
        group,
      ]),
    ];
    return result;
  });
  config = withInfoPlist(config, (result) => {
    result.modResults.EduMfaNotificationAppGroup = group;
    return result;
  });
  const eas = ((config.extra ??= {}).eas ??= {});
  const ios = (((eas.build ??= {}).experimental ??= {}).ios ??= {});
  ios.appExtensions = [
    ...(ios.appExtensions ?? []).filter(
      (extension) =>
        !targets.some((target) => target.name === extension.targetName),
    ),
    ...targets.map((target) => ({
      targetName: target.name,
      bundleIdentifier: `${bundle}.${target.suffix}`,
      entitlements: { "com.apple.security.application-groups": [group] },
    })),
  ];
  return withXcodeProject(config, async (result) => {
    await configureProject(
      result.modResults,
      result,
      result.modRequest.projectRoot,
      result.modRequest.platformProjectRoot,
    );
    return result;
  });
};
module.exports.configureProject = configureProject;
