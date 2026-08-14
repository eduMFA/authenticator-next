import { readFile } from "node:fs/promises";

const [artifactPath, releaseKind] = process.argv.slice(2);
const token = process.env.GITHUB_RELEASE_TOKEN;
const repository = process.env.RELEASE_REPOSITORY;
const tag = process.env.RELEASE_TAG;

if (!artifactPath || !token || !repository || !tag) {
  throw new Error(
    "artifact path, GITHUB_RELEASE_TOKEN, RELEASE_REPOSITORY, and RELEASE_TAG are required",
  );
}

const headers = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2022-11-28",
};
const apiUrl = `https://api.github.com/repos/${repository}`;

async function githubRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...options.headers },
  });

  if (!response.ok) {
    throw new Error(
      `GitHub API request failed (${response.status}): ${await response.text()}`,
    );
  }

  return response;
}

let releaseResponse = await fetch(
  `${apiUrl}/releases/tags/${encodeURIComponent(tag)}`,
  { headers },
);

if (releaseResponse.status === 404) {
  releaseResponse = await githubRequest(`${apiUrl}/releases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tag_name: tag,
      name: tag,
      generate_release_notes: true,
      prerelease: releaseKind === "prerelease",
    }),
  });
} else if (!releaseResponse.ok) {
  throw new Error(
    `Unable to read GitHub release (${releaseResponse.status}): ${await releaseResponse.text()}`,
  );
}

const release = await releaseResponse.json();
const assetName = `edumfa-${tag.replaceAll("/", "-")}.apk`;
const existingAsset = release.assets.find((asset) => asset.name === assetName);

if (existingAsset) {
  await githubRequest(`${apiUrl}/releases/assets/${existingAsset.id}`, {
    method: "DELETE",
  });
}

const artifact = await readFile(artifactPath);
const uploadUrl = new URL(release.upload_url.replace("{?name,label}", ""));
uploadUrl.searchParams.set("name", assetName);

await githubRequest(uploadUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/vnd.android.package-archive",
    "Content-Length": String(artifact.byteLength),
  },
  body: artifact,
});

console.log(`Published ${assetName} to GitHub release ${tag}`);
