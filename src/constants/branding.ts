// A nonbreaking space keeps the app name together in translated copy.
export const keepAppNameTogether = (text: string) =>
  text.replaceAll("eduMFA Push", "eduMFA\u00A0Push");
