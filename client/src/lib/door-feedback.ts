import type { ScanResult } from "../generated/contracts";

/** A pure mapping so every backend outcome remains testable outside Expo. */
export function hapticKind(result: ScanResult): "success" | "error" {
  return result.admitted ? "success" : "error";
}
