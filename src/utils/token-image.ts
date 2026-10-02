export function parseImageUrl(image: unknown): string | null | undefined {
  if (image === null || image === "") return null;
  if (typeof image !== "string") return undefined;

  try {
    const url = new URL(image);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}
