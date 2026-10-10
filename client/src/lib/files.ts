import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import type { SessionClient } from "./session-client";

export async function savePrivateFile(
  client: SessionClient,
  path: string,
  filename: string,
) {
  const blob = await client.download(path);
  if (!/\.[a-z0-9]+$/i.test(filename))
    filename +=
      (
        {
          "application/pdf": ".pdf",
          "image/jpeg": ".jpg",
          "image/png": ".png",
        } as Record<string, string>
      )[blob.type] ?? "";
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("File sharing is unavailable on this device.");
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error("Could not read the downloaded file."));
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.readAsDataURL(blob);
  });
  const file = new File(
    Paths.cache,
    `${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, "_")}`,
  );
  try {
    file.write(base64, { encoding: "base64" });
    await Sharing.shareAsync(file.uri, { mimeType: blob.type });
  } finally {
    if (file.exists) file.delete();
  }
}
