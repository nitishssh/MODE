import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import type { ScanResult } from "../generated/contracts";
import { hapticKind } from "./door-feedback";

/** Runs once after a server scan completes; web intentionally has no haptics. */
export async function notifyDoorResult(result: ScanResult) {
  if (Platform.OS === "web") return;
  const kind = hapticKind(result) === "success"
    ? Haptics.NotificationFeedbackType.Success
    : Haptics.NotificationFeedbackType.Error;
  await Haptics.notificationAsync(kind).catch(() => undefined);
}
