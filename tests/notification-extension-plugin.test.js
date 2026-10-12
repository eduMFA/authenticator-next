const fs = require("node:fs/promises");
const { test, expect } = require("@jest/globals");
const os = require("node:os");
const path = require("node:path");
const xcode = require("xcode");
const plist = require("@expo/plist").default;
const plugin = require("../plugins/with-notification-service.cjs");

// Minimal host project: exercise real Xcode target creation and serialization,
// without depending on the ignored/generated ios directory or running a build.
const hostProject = `{
  archiveVersion = 1; classes = {}; objectVersion = 54;
  objects = {
    /* Begin PBXProject section */
    A00000000000000000000001 = { isa = PBXProject; attributes = {}; mainGroup = A00000000000000000000002; targets = (A00000000000000000000004 /* App */,); };
    /* End PBXProject section */
    /* Begin PBXGroup section */
    A00000000000000000000002 = { isa = PBXGroup; children = (A00000000000000000000003,); sourceTree = "<group>"; };
    A00000000000000000000003 = { isa = PBXGroup; children = (); name = Products; sourceTree = "<group>"; };
    /* End PBXGroup section */
    /* Begin PBXNativeTarget section */
    A00000000000000000000004 = { isa = PBXNativeTarget; name = App; buildConfigurationList = A00000000000000000000005; buildPhases = (); dependencies = (); productType = "com.apple.product-type.application"; };
    /* End PBXNativeTarget section */
    /* Begin XCConfigurationList section */
    A00000000000000000000005 = { isa = XCConfigurationList; buildConfigurations = (A00000000000000000000006 /* Debug */, A00000000000000000000007 /* Release */,); defaultConfigurationName = Release; };
    /* End XCConfigurationList section */
    /* Begin XCBuildConfiguration section */
    A00000000000000000000006 = { isa = XCBuildConfiguration; name = Debug; buildSettings = { CURRENT_PROJECT_VERSION = 42; MARKETING_VERSION = 2.0.0; DEVELOPMENT_TEAM = TEAM123; }; };
    A00000000000000000000007 = { isa = XCBuildConfiguration; name = Release; buildSettings = { CURRENT_PROJECT_VERSION = 42; MARKETING_VERSION = 2.0.0; DEVELOPMENT_TEAM = TEAM123; }; };
    /* End XCBuildConfiguration section */
    /* Begin PBXBuildFile section */
    /* End PBXBuildFile section */
    /* Begin PBXFileReference section */
    /* End PBXFileReference section */
  };
  rootObject = A00000000000000000000001;
}`;

test("creates one embedded, signed service target with shared App Group and current sources", async () => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "edumfa-extension-test-"),
  );
  try {
    const file = path.join(root, "project.pbxproj");
    await fs.writeFile(file, `${hostProject}\n`);
    const project = xcode.project(file);
    project.parseSync();
    const config = {
      ios: { bundleIdentifier: "io.edumfa.app" },
      version: "1.0.0",
    };
    await plugin.configureProject(project, config, process.cwd(), root);
    await plugin.configureProject(project, config, process.cwd(), root);
    await fs.writeFile(file, project.writeSync());
    const serialized = xcode.project(file);
    serialized.parseSync();
    const targets = Object.entries(serialized.pbxNativeTargetSection()).filter(
      ([key, target]) =>
        !key.endsWith("_comment") &&
        target.name === '"EduMfaNotificationService"',
    );
    expect(targets).toHaveLength(1);
    const [targetId, target] = targets[0];
    expect(target.productType).toBe('"com.apple.product-type.app-extension"');
    expect(serialized.getFirstTarget().firstTarget.dependencies).toHaveLength(
      1,
    );
    const phases = serialized.hash.project.objects.PBXSourcesBuildPhase;
    const sourcePhase = target.buildPhases
      .map((phase) => phases[phase.value])
      .find(Boolean);
    expect(sourcePhase.files).toHaveLength(3);
    const configs = serialized.pbxXCBuildConfigurationSection();
    const list =
      serialized.pbxXCConfigurationList()[target.buildConfigurationList];
    for (const reference of list.buildConfigurations) {
      expect(configs[reference.value].buildSettings).toMatchObject({
        APPLICATION_EXTENSION_API_ONLY: "YES",
        CURRENT_PROJECT_VERSION: 42,
        MARKETING_VERSION: "2.0.0",
        DEVELOPMENT_TEAM: "TEAM123",
        PRODUCT_BUNDLE_IDENTIFIER: '"io.edumfa.app.NotificationService"',
      });
    }
    const copies = Object.entries(
      serialized.hash.project.objects.PBXCopyFilesBuildPhase,
    ).filter(([key]) => !key.endsWith("_comment"));
    expect(copies).toHaveLength(1);
    expect(copies[0][1].dstSubfolderSpec).toBe(13);
    expect(copies[0][1].files).toHaveLength(1);
    const product =
      serialized.pbxBuildFileSection()[copies[0][1].files[0].value];
    expect(product.settings.ATTRIBUTES).toContain("CodeSignOnCopy");
    const folder = path.join(root, "EduMfaNotificationService");
    expect(
      plist.parse(await fs.readFile(path.join(folder, "Info.plist"), "utf8")),
    ).toMatchObject({
      EduMfaNotificationAppGroup: "group.io.edumfa.app.notifications",
      NSExtension: {
        NSExtensionPointIdentifier: "com.apple.usernotifications.service",
      },
    });
    expect(
      plist.parse(
        await fs.readFile(
          path.join(folder, "EduMfaNotificationService.entitlements"),
          "utf8",
        ),
      ),
    ).toEqual({
      "com.apple.security.application-groups": [
        "group.io.edumfa.app.notifications",
      ],
    });
    expect(
      await fs.readFile(path.join(folder, "NotificationService.swift"), "utf8"),
    ).toBe(
      await fs.readFile(
        "modules/edumfa-notifications/extension/NotificationService.swift",
        "utf8",
      ),
    );
    expect(targetId).toBeTruthy();
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("declares EAS extension credentials and app entitlements without duplicating other extensions", () => {
  let config = {
    ios: { bundleIdentifier: "io.edumfa.app" },
    extra: {
      eas: {
        projectId: "project",
        build: {
          experimental: {
            ios: {
              appExtensions: [
                {
                  targetName: "Other",
                  bundleIdentifier: "io.edumfa.app.other",
                },
              ],
            },
          },
        },
      },
    },
  };
  config = plugin(config);
  config = plugin(config);
  const extensions = config.extra.eas.build.experimental.ios.appExtensions;
  expect(extensions).toHaveLength(2);
  expect(extensions[1]).toMatchObject({
    targetName: "EduMfaNotificationService",
    bundleIdentifier: "io.edumfa.app.NotificationService",
    entitlements: {
      "com.apple.security.application-groups": [
        "group.io.edumfa.app.notifications",
      ],
    },
  });
  expect(config.extra.eas.projectId).toBe("project");
});
