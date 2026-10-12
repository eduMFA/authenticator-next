import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

// Run native logic tests through Swift's interpreter without building the app.
const temporaryDirectory = await mkdtemp(
  join(tmpdir(), "edumfa-notifications-"),
);
try {
  const paths = [
    "modules/edumfa-rsa/ios/EduMfaRsaCrypto.swift",
    "modules/edumfa-notifications/ios/EduMfaNotificationActions.swift",
    "tests/native-notification-actions.swift",
  ];
  const sources = await Promise.all(
    paths.map((path) => readFile(resolve(path), "utf8")),
  );
  const script = join(temporaryDirectory, "tests.swift");
  // The interpreter runs both modules in one file; app compilation uses the pod import.
  await writeFile(
    script,
    sources.join("\n").replace(/^import EduMfaRsa\n/gm, ""),
  );
  const result = spawnSync(
    "xcrun",
    ["swift", "-module-cache-path", join(temporaryDirectory, "cache"), script],
    {
      stdio: "inherit",
    },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
